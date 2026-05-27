import { prisma } from '../config/db';
import { AppError } from '../middleware/errorHandler.middleware';
import { ROLES, STAGES } from '../config/constants';

const QUERY_INCLUDE = {
  askedBy:     { select: { id: true, username: true, officeLocation: true } },
  respondedBy: { select: { id: true, username: true } },
};

export async function getQueriesForApplication(applicationId: string) {
  return prisma.query.findMany({
    where: { applicationId },
    include: QUERY_INCLUDE,
    orderBy: { createdAt: 'asc' },
  });
}

// Officer calls this — behaviour differs by role:
//   NodalOfficerA  → app moves to QuerySent (direct to applicant)
//   TechnicalOfficer → app moves to WithNodalOfficerA (Nodal forwards manually)
export async function createQuery(applicationId: string, askedById: string, text: string, callerRoleCode: string) {
  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app) throw new AppError('Application not found', 404);
  if (['Draft', 'Approved', 'Rejected', 'Closed'].includes(app.stage)) {
    throw new AppError(`Cannot raise a query on an application in stage: ${app.stage}`, 400);
  }

  const isTechQuery = callerRoleCode === ROLES.TECHNICAL_OFFICER;
  const isECQuery   = callerRoleCode === ROLES.EXPERT_COMMITTEE;

  const [query] = await prisma.$transaction([
    prisma.query.create({
      data: {
        applicationId,
        text,
        askedById,
        // Tech + EC queries revert to Nodal when applicant responds
        revertedFromStage: (isTechQuery || isECQuery) ? STAGES.WITH_NODAL_OFFICER_A : app.stage,
        originStage:       isTechQuery ? STAGES.WITH_TECHNICAL_OFFICER
                         : isECQuery   ? STAGES.WITH_EXPERT_COMMITTEE
                         : null,
      },
      include: QUERY_INCLUDE,
    }),
    prisma.application.update({
      where: { id: applicationId },
      // Tech + EC queries go to Nodal inbox; Nodal queries go directly to applicant
      data: { stage: (isTechQuery || isECQuery) ? STAGES.WITH_NODAL_OFFICER_A : 'QuerySent' },
    }),
  ]);

  return query;
}

// Nodal Officer forwards a Tech Officer or EC query to the applicant
export async function nodalForwardQueryToApplicant(queryId: string) {
  const query = await prisma.query.findUnique({
    where: { id: queryId },
    include: { application: true },
  });
  if (!query) throw new AppError('Query not found', 404);
  const validOrigins = [STAGES.WITH_TECHNICAL_OFFICER, STAGES.WITH_EXPERT_COMMITTEE];
  if (!validOrigins.includes(query.originStage as typeof STAGES[keyof typeof STAGES])) throw new AppError('Not a forwarded query', 400);
  if (query.nodalForwardedAt) throw new AppError('Query already forwarded to applicant', 400);

  const [updated] = await prisma.$transaction([
    prisma.query.update({
      where: { id: queryId },
      data:  { nodalForwardedAt: new Date() },
      include: QUERY_INCLUDE,
    }),
    prisma.application.update({
      where: { id: query.applicationId },
      data:  { stage: 'QuerySent' },
    }),
  ]);

  return updated;
}

// Nodal Officer forwards applicant's response back to the originating officer (TO or EC)
export async function nodalForwardResponseToTech(queryId: string) {
  const query = await prisma.query.findUnique({
    where: { id: queryId },
    include: { application: true },
  });
  if (!query) throw new AppError('Query not found', 404);
  const validOrigins = [STAGES.WITH_TECHNICAL_OFFICER, STAGES.WITH_EXPERT_COMMITTEE];
  if (!validOrigins.includes(query.originStage as typeof STAGES[keyof typeof STAGES])) throw new AppError('Not a forwarded query', 400);
  if (!query.response) throw new AppError('Applicant has not responded yet', 400);
  if (query.nodalFwdResponseAt) throw new AppError('Response already forwarded', 400);

  const [updated] = await prisma.$transaction([
    prisma.query.update({
      where: { id: queryId },
      data:  { nodalFwdResponseAt: new Date() },
      include: QUERY_INCLUDE,
    }),
    prisma.application.update({
      where: { id: query.applicationId },
      data:  { stage: query.originStage as string },
    }),
  ]);

  return updated;
}

// Applicant calls this — saves response and reverts app stage
export async function respondToQuery(queryId: string, applicantId: string, response: string) {
  const query = await prisma.query.findUnique({
    where:   { id: queryId },
    include: { application: true },
  });
  if (!query) throw new AppError('Query not found', 404);
  if (query.application.applicantId !== applicantId) throw new AppError('Forbidden', 403);
  if (query.response) throw new AppError('This query has already been answered', 400);

  const [updated] = await prisma.$transaction([
    prisma.query.update({
      where: { id: queryId },
      data: {
        response,
        respondedById: applicantId,
        respondedAt:   new Date(),
      },
      include: QUERY_INCLUDE,
    }),
    prisma.application.update({
      where: { id: query.applicationId },
      // Tech queries revert to WithNodalOfficerA; Nodal queries revert to their original stage
      data:  { stage: query.revertedFromStage },
    }),
  ]);

  return updated;
}
