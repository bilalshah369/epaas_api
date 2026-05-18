import { prisma } from '../config/db';
import { AppError } from '../middleware/errorHandler.middleware';

// Generic single-stage advance — caller must validate the role has permission.
export async function advanceStage(
  appId:                string,
  requiredCurrentStage: string,
  targetStage:          string,
) {
  const app = await prisma.application.findUnique({ where: { id: appId } });
  if (!app) throw new AppError('Application not found', 404);
  if (app.stage !== requiredCurrentStage) {
    throw new AppError(
      `Cannot advance: application is in "${app.stage}", expected "${requiredCurrentStage}"`,
      400,
    );
  }
  return prisma.application.update({
    where: { id: appId },
    data:  { stage: targetStage },
  });
}

// Fetch all applications in a given stage (used by officer dashboards)
export async function getApplicationsByStage(stage: string) {
  return prisma.application.findMany({
    where:   { stage },
    include: { applicant: { select: { username: true, email: true, licenseNumber: true } } },
    orderBy: { submittedAt: 'asc' }, // oldest first = highest priority
  });
}

// Fetch all non-draft applications (overview for Nodal Officer A dashboard)
export async function getAllApplications() {
  return prisma.application.findMany({
    where:   { stage: { not: 'Draft' } },
    include: { applicant: { select: { username: true, email: true, licenseNumber: true } } },
    orderBy: { submittedAt: 'desc' },
  });
}
