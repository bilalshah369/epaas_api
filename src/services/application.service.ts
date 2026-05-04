import { prisma } from '../config/db';
import { AppError } from '../middleware/errorHandler.middleware';

const SUBMITTED_STAGES = [
  'Submitted', 'WithNodalOfficerA', 'WithTechnicalOfficer',
  'WithExpertCommittee', 'WithNodalPointB', 'DecisionPending',
  'WithCEO', 'WithChairperson',
];

const TYPE_CODES: Record<string, string> = {
  NSF: 'NSF', ClaimApproval: 'CA', AyurvedaAahara: 'AA', RPET: 'RPET', AnyOther: 'AO',
};

// ── Reference number helpers ──────────────────────────────────────────────────
async function draftRef(): Promise<string> {
  const year = new Date().getFullYear();
  const n    = (await prisma.application.count()) + 1;
  return `DRAFT-${year}-${String(n).padStart(3, '0')}`;
}

async function submittedRef(applicationType: string): Promise<string> {
  const year = new Date().getFullYear();
  const code = TYPE_CODES[applicationType] ?? 'APP';
  const n    = (await prisma.application.count({ where: { stage: { not: 'Draft' } } })) + 1;
  return `APP-${year}-${code}-${String(n).padStart(5, '0')}`;
}

// ── Public service methods ────────────────────────────────────────────────────
export async function getMyApplications(applicantId: string) {
  return prisma.application.findMany({
    where: { applicantId },
    orderBy: { updatedAt: 'desc' },
  });
}

// applicantId is required for Applicant role (ownership check); officers pass undefined
export async function getApplication(id: string, applicantId?: string) {
  const where = applicantId ? { id, applicantId } : { id };
  const app   = await prisma.application.findFirst({ where });
  if (!app) throw new AppError('Application not found', 404);
  return app;
}

export async function createDraft(applicantId: string, applicationType: string, companyName: string) {
  const referenceNumber = await draftRef();
  return prisma.application.create({
    data: {
      referenceNumber,
      applicantId,
      applicationType,
      companyName,
      stage: 'Draft',
    },
  });
}

export async function saveDraft(id: string, applicantId: string, formData: object, productName?: string) {
  const app = await prisma.application.findFirst({ where: { id, applicantId, stage: 'Draft' } });
  if (!app) throw new AppError('Draft not found', 404);
  return prisma.application.update({
    where: { id },
    data:  { formData, ...(productName ? { productName } : {}) },
  });
}

export async function submitApplication(id: string, applicantId: string) {
  const app = await prisma.application.findFirst({ where: { id, applicantId, stage: 'Draft' } });
  if (!app) throw new AppError('Draft application not found', 404);

  const newRef = await submittedRef(app.applicationType);
  return prisma.application.update({
    where: { id },
    data:  {
      referenceNumber: newRef,
      stage:           'WithNodalOfficerA',
      submittedAt:     new Date(),
    },
  });
}

export function getBin(stage: string): string {
  if (stage === 'Draft') return 'incomplete';
  if (stage === 'QuerySent') return 'reverted';
  if (stage === 'Rejected') return 'rejected';
  if (['Approved', 'Closed'].includes(stage)) return 'approved';
  if (SUBMITTED_STAGES.includes(stage)) return 'submitted';
  return 'submitted';
}
