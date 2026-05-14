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

// Normalize CA/AA variants to canonical codes for filtering
const TYPE_NORM: Record<string, string[]> = {
  NSF:            ['NSF'],
  CA:             ['CA', 'ClaimApproval'],
  ClaimApproval:  ['CA', 'ClaimApproval'],
  AA:             ['AA', 'AyurvedaAahara'],
  AyurvedaAahara: ['AA', 'AyurvedaAahara'],
  RPET:           ['RPET'],
  AnyOther:       ['AnyOther'],
};

export interface ApplicationFilters {
  applicationType?: string;
  workflowType?:    string;
  stage?:           string;
}

// ── Public service methods ────────────────────────────────────────────────────
export async function getMyApplications(applicantId: string, filters: ApplicationFilters = {}) {
  const where: Record<string, unknown> = { applicantId };

  if (filters.applicationType) {
    const variants = TYPE_NORM[filters.applicationType] ?? [filters.applicationType];
    where.applicationType = { in: variants };
  }
  if (filters.workflowType) {
    where.workflowType = filters.workflowType;
  }
  if (filters.stage) {
    where.stage = filters.stage;
  }

  return prisma.application.findMany({
    where,
    include: { documents: true },
    orderBy: { updatedAt: 'desc' },
  });
}

// applicantId is required for Applicant role (ownership check); officers pass undefined
export async function getApplication(id: string, applicantId?: string) {
  const where = applicantId ? { id, applicantId } : { id };
  const app   = await prisma.application.findFirst({
    where,
    include: { documents: true },
  });
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

function extractMeta(applicationType: string, fd: Record<string, unknown>): {
  address: string; foodCategory: string; workflowType: string;
} {
  const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

  if (applicationType === 'AyurvedaAahara' || applicationType === 'AA') {
    return {
      address:      s(fd.registeredOfficeAddress) || s(fd.manufacturingAddress),
      foodCategory: s(fd.ayurvedaCategory),
      workflowType: s(fd.workflowType) || 'New',
    };
  }

  if (applicationType === 'ClaimApproval' || applicationType === 'CA') {
    return {
      address:      s(fd.applicantAddress),
      foodCategory: s(fd.productCategory),
      workflowType: s(fd.workflowType) || 'New',
    };
  }

  if (applicationType === 'RPET') {
    return {
      address:      s(fd.addressOfPremise),
      foodCategory: 'FCM-rPET Packaging',
      workflowType: s(fd.workflowType) || 'New',
    };
  }

  // NSF / AnyOther — nested step2
  const step2 = (fd.step2 && typeof fd.step2 === 'object') ? fd.step2 as Record<string, unknown> : {};
  return {
    address:      s(step2.orgAddress) || s(step2.mfgAddress),
    foodCategory: s(step2.productCategory),
    workflowType: s(fd.workflowType) || 'New',
  };
}

export async function saveDraft(id: string, applicantId: string, formData: object, productName?: string) {
  const app = await prisma.application.findFirst({ where: { id, applicantId, stage: 'Draft' } });
  if (!app) throw new AppError('Draft not found', 404);

  const meta = extractMeta(app.applicationType, formData as Record<string, unknown>);
  return prisma.application.update({
    where: { id },
    data: {
      formData,
      ...(productName       ? { productName }           : {}),
      ...(meta.address      ? { address: meta.address } : {}),
      ...(meta.foodCategory ? { foodCategory: meta.foodCategory } : {}),
      workflowType: meta.workflowType,
    },
  });
}

export async function deleteDraft(id: string, applicantId: string) {
  const app = await prisma.application.findFirst({ where: { id, applicantId, stage: 'Draft' } });
  if (!app) throw new AppError('Draft not found', 404);
  // Delete child records first to satisfy FK constraints (no cascade in schema)
  await prisma.document.deleteMany({ where: { applicationId: id } });
  await prisma.query.deleteMany({ where: { applicationId: id } });
  await prisma.application.delete({ where: { id } });
}

export async function submitApplication(id: string, applicantId: string) {
  const app = await prisma.application.findFirst({ where: { id, applicantId, stage: 'Draft' } });
  if (!app) throw new AppError('Draft application not found', 404);

  // Validate formData exists and is complete enough to submit
  if (!app.formData) {
    throw new AppError('Application form is incomplete. Please fill in all required fields before submitting.', 422);
  }

  const fd = app.formData as Record<string, unknown>;

  // Extract and validate payment reference — location differs by form type
  let paymentRef = '';
  if (typeof fd.paymentReference === 'string') {
    // CA and AA use flat structure
    paymentRef = fd.paymentReference;
  } else if (fd.step5 && typeof fd.step5 === 'object') {
    // NSF / rPET / AnyOther use step5.paymentReference
    const step5 = fd.step5 as Record<string, unknown>;
    if (typeof step5.paymentReference === 'string') paymentRef = step5.paymentReference;
  }

  if (!paymentRef.trim()) {
    throw new AppError('Payment reference is required. Please complete the payment step before submitting.', 422);
  }

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
