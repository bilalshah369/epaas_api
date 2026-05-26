import { prisma } from '../config/db';
import { AppError } from '../middleware/errorHandler.middleware';
import { autoAssignNodal } from './workflow.service';
import { isPaymentComplete } from './payment.service';

const SUBMITTED_STAGES = [
  'Submitted', 'WithNodalOfficerA', 'WithTechnicalOfficer',
  'WithExpertCommittee', 'WithNodalPointB', 'DecisionPending',
  'WithCEO', 'WithChairperson',
];

const TYPE_CODES: Record<string, string> = {
  NSF: 'NSF', ClaimApproval: 'CA', AyurvedaAahara: 'AA', RPET: 'RPET', AnyOther: 'AO',
};

// ── Approval / Rejection number generation ────────────────────────────────────
// Format: YY SS AA CC NNNNNN
//   YY     = 2-digit year
//   SS     = 01 (Approved) | 02 (Rejected)
//   AA     = Approval Authority Code (application type)
//   CC     = Product Category Code
//   NNNNNN = 6-digit globally-unique sequential counter

const APPR_TYPE_CODES: Record<string, string> = {
  NSF: '01', ClaimApproval: '02', RPET: '03', AyurvedaAahara: '04', AnyOther: '05',
};

const FOOD_CAT_CODES: Record<string, string> = {
  'Dairy & Products':                 '01',
  'Cereals & Pulse Products':         '02',
  'Bakery Products':                  '03',
  'Beverages':                        '04',
  'Meat & Poultry':                   '05',
  'Fish & Marine Products':           '06',
  'Fruits & Vegetables':              '07',
  'Fats & Oils':                      '08',
  'Confectionery':                    '09',
  'Health & Nutritional Foods':       '10',
  'Herbal & Ayurvedic Products':      '11',
  'Novel Foods':                      '12',
  'Fortified Foods':                  '13',
  'Infant Foods':                     '14',
  'Food Additives & Processing Aids': '15',
  'Packaging Materials':              '16',
  'FCM-rPET Packaging':               '16',
  // Ayurveda Aahara sub-categories
  'A':  '17',
  'B':  '18',
  'B1': '19',
  'B2': '20',
};

export async function generateApprovalNumber(
  applicationType: string,
  foodCategory:    string,
  isApproved:      boolean,
): Promise<string> {
  const yy         = String(new Date().getFullYear()).slice(-2);
  const statusCode = isApproved ? '01' : '02';
  const typeCode   = APPR_TYPE_CODES[applicationType] ?? '00';
  const catCode    = FOOD_CAT_CODES[foodCategory?.trim()] ?? '00';
  const count      = await prisma.application.count({ where: { approvalNumber: { not: null } } });
  const seq        = String(count + 1).padStart(6, '0');
  return `${yy} ${statusCode} ${typeCode} ${catCode} ${seq}`;
}

// ── Reference number helpers ──────────────────────────────────────────────────
async function draftRef(): Promise<string> {
  const year = new Date().getFullYear();
  let n = (await prisma.application.count()) + 1;
  let ref = `DRAFT-${year}-${String(n).padStart(3, '0')}`;
  while (await prisma.application.findFirst({ where: { referenceNumber: ref } })) {
    n++;
    ref = `DRAFT-${year}-${String(n).padStart(3, '0')}`;
  }
  return ref;
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
  address: string; foodCategory: string;
} {
  const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

  if (applicationType === 'AyurvedaAahara' || applicationType === 'AA') {
    return {
      address:      s(fd.registeredOfficeAddress) || s(fd.manufacturingAddress),
      foodCategory: s(fd.ayurvedaCategory),
    };
  }

  if (applicationType === 'ClaimApproval' || applicationType === 'CA') {
    return {
      address:      s(fd.applicantAddress),
      foodCategory: s(fd.productCategory),
    };
  }

  if (applicationType === 'RPET') {
    return {
      address:      s(fd.addressOfPremise),
      foodCategory: 'FCM-rPET Packaging',
    };
  }

  // NSF / AnyOther — nested step2
  const step2 = (fd.step2 && typeof fd.step2 === 'object') ? fd.step2 as Record<string, unknown> : {};
  return {
    address:      s(step2.orgAddress) || s(step2.mfgAddress),
    foodCategory: s(step2.productCategory),
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

  const paid = await isPaymentComplete(id, app.applicationType);
  if (!paid) {
    throw new AppError('Payment not completed. Please complete the payment before submitting.', 422);
  }

  const newRef        = await submittedRef(app.applicationType);
  const assignedNodalId = await autoAssignNodal(app.applicationType);
  return prisma.application.update({
    where: { id },
    data:  {
      referenceNumber: newRef,
      stage:           'WithNodalOfficerA',
      submittedAt:     new Date(),
      ...(assignedNodalId ? { assignedNodalId } : {}),
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
