import { prisma } from '../config/db';
import { AppError } from '../middleware/errorHandler.middleware';

const APPEAL_WINDOW_DAYS = 30;
const REVIEW_WINDOW_DAYS = 30;

function daysLeft(from: Date, windowDays: number): number {
  const diff = windowDays - Math.floor((Date.now() - from.getTime()) / 86_400_000);
  return Math.max(0, diff);
}

// ── Appeal ────────────────────────────────────────────────────────────────────

export async function listAppeals(applicantId: string) {
  // 1. Rejected applications without an appeal yet → "Pending Filing"
  const rejectedApps = await prisma.application.findMany({
    where: { applicantId, stage: 'Rejected', appeals: { none: {} } },
  });

  // 2. Existing appeal records
  const appeals = await prisma.appeal.findMany({
    where:   { applicantId },
    include: { application: true },
    orderBy: { filedAt: 'desc' },
  });

  const pendingFiling = rejectedApps.map((a) => ({
    id:            null as string | null,
    applicationId: a.id,
    ref:           a.referenceNumber,
    company:       a.companyName,
    product:       a.productName ?? '—',
    appType:       a.applicationType,
    foodCategory:  a.foodCategory,
    rejDate:       (a.rejectedAt ?? a.updatedAt).toISOString(),
    daysLeft:      daysLeft(a.rejectedAt ?? a.updatedAt, APPEAL_WINDOW_DAYS),
    appealStatus:  'PendingFiling' as const,
  }));

  const filed = appeals.map((ap) => ({
    id:              ap.id,
    applicationId:   ap.applicationId,
    ref:             ap.application.referenceNumber,
    company:         ap.application.companyName,
    product:         ap.application.productName ?? '—',
    appType:         ap.application.applicationType,
    foodCategory:    ap.application.foodCategory,
    rejDate:         (ap.application.rejectedAt ?? ap.application.updatedAt).toISOString(),
    daysLeft:        0,
    appealStatus:    ap.status as 'AppealPending' | 'AppealApproved' | 'AppealRejected',
    decisionRemarks: ap.decisionRemarks ?? null,
  }));

  return [...pendingFiling, ...filed];
}

export async function fileAppeal(applicantId: string, applicationId: string, grounds: string, attachmentUrl?: string) {
  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app)                        throw new AppError('Application not found', 404);
  if (app.applicantId !== applicantId) throw new AppError('Forbidden', 403);
  if (app.stage !== 'Rejected')    throw new AppError('Only rejected applications can be appealed', 400);

  const existing = await prisma.appeal.findFirst({ where: { applicationId, applicantId } });
  if (existing) throw new AppError('Appeal already filed for this application', 409);

  const window = daysLeft(app.rejectedAt ?? app.updatedAt, APPEAL_WINDOW_DAYS);
  if (window === 0) throw new AppError('Appeal window has expired', 400);

  return prisma.appeal.create({
    data: { applicationId, applicantId, grounds, attachmentUrl: attachmentUrl ?? null, status: 'AppealPending' },
    include: { application: true },
  });
}

// ── Review ────────────────────────────────────────────────────────────────────

export async function listReviews(applicantId: string) {
  // 1. Rejected appeals without a review yet → "Pending Review"
  const rejectedAppeals = await prisma.appeal.findMany({
    where:   { applicantId, status: 'AppealRejected', reviews: { none: {} } },
    include: { application: true },
  });

  // 2. Existing review records
  const reviews = await prisma.review.findMany({
    where:   { applicantId },
    include: { application: true, appeal: true },
    orderBy: { filedAt: 'desc' },
  });

  const pendingReview = rejectedAppeals.map((ap) => ({
    id:            null as string | null,
    applicationId: ap.applicationId,
    appealId:      ap.id,
    ref:           ap.application.referenceNumber,
    company:       ap.application.companyName,
    product:       ap.application.productName ?? '—',
    appType:       ap.application.applicationType,
    foodCategory:  ap.application.foodCategory,
    appealRejDate: (ap.decisionAt ?? ap.updatedAt).toISOString(),
    daysLeft:      daysLeft(ap.decisionAt ?? ap.updatedAt, REVIEW_WINDOW_DAYS),
    reviewStatus:  'PendingReview' as const,
  }));

  const filed = reviews.map((rv) => ({
    id:            rv.id,
    applicationId: rv.applicationId,
    appealId:      rv.appealId,
    ref:           rv.application.referenceNumber,
    company:       rv.application.companyName,
    product:       rv.application.productName ?? '—',
    appType:       rv.application.applicationType,
    foodCategory:  rv.application.foodCategory,
    appealRejDate: (rv.appeal.decisionAt ?? rv.appeal.updatedAt).toISOString(),
    daysLeft:      0,
    reviewStatus:  rv.status as 'ReviewPending' | 'ReviewDisposed' | 'DeadlinePassed',
  }));

  return [...pendingReview, ...filed];
}

export async function fileReview(applicantId: string, appealId: string, grounds: string, attachmentUrl?: string) {
  const appeal = await prisma.appeal.findUnique({
    where:   { id: appealId },
    include: { application: true },
  });
  if (!appeal)                          throw new AppError('Appeal not found', 404);
  if (appeal.applicantId !== applicantId) throw new AppError('Forbidden', 403);
  if (appeal.status !== 'AppealRejected') throw new AppError('Review only allowed after appeal rejection', 400);

  const existing = await prisma.review.findFirst({ where: { appealId, applicantId } });
  if (existing) throw new AppError('Review already filed for this appeal', 409);

  const window = daysLeft(appeal.decisionAt ?? appeal.updatedAt, REVIEW_WINDOW_DAYS);
  if (window === 0) throw new AppError('Review window has expired', 400);

  const currentTd = (appeal.application.toDecision as Record<string, unknown>) ?? {};
  const review = await prisma.review.create({
    data: {
      applicationId: appeal.applicationId,
      appealId,
      applicantId,
      grounds,
      attachmentUrl: attachmentUrl ?? null,
      status: 'ReviewPending',
    },
  });
  // Route to Nodal A (not Chairperson) — Nodal A must forward it manually
  await prisma.application.update({
    where: { id: appeal.applicationId },
    data: { stage: 'WithNodalOfficerA', toDecision: { ...currentTd, reviewPendingForward: review.id } },
  });
  return prisma.review.findUniqueOrThrow({
    where: { id: review.id },
    include: { application: true, appeal: true },
  });
}
