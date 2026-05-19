import { Request, Response, NextFunction } from 'express';
import { getApplicationsByStage, getAllApplications, advanceStage } from '../services/workflow.service';
import { prisma } from '../config/db';
import { AppError } from '../middleware/errorHandler.middleware';
import { mergeSupDoc } from '../services/extension.service';

const APP_INCLUDE = { applicant: { select: { username: true, email: true, licenseNumber: true } } };

// GET /api/nodal-a/applications  →  only WithNodalOfficerA (scrutiny queue)
export async function listPending(req: Request, res: Response, next: NextFunction) {
  try {
    const applications = await getApplicationsByStage('WithNodalOfficerA');
    res.json({ applications });
  } catch (e) { next(e); }
}

// GET /api/nodal-a/all  →  all non-draft applications (dashboard overview)
export async function listAll(req: Request, res: Response, next: NextFunction) {
  try {
    const applications = await getAllApplications();
    res.json({ applications });
  } catch (e) { next(e); }
}

// GET /api/nodal-a/appeal-review  →  combined appeal + review records with application
export async function listAppealReview(req: Request, res: Response, next: NextFunction) {
  try {
    const [appeals, reviews] = await Promise.all([
      prisma.appeal.findMany({
        include: { application: { include: APP_INCLUDE } },
        orderBy: { filedAt: 'desc' },
      }),
      prisma.review.findMany({
        include: { application: { include: APP_INCLUDE } },
        orderBy: { filedAt: 'desc' },
      }),
    ]);
    const records = [
      ...appeals.map((a) => ({ ...a, type: 'Appeal' as const })),
      ...reviews.map((r) => ({ ...r, type: 'Review' as const })),
    ].sort((a, b) => new Date(b.filedAt).getTime() - new Date(a.filedAt).getTime());
    res.json({ records });
  } catch (e) { next(e); }
}

// GET /api/nodal-a/extension-requests  →  all extension requests with application
export async function listExtensionRequests(req: Request, res: Response, next: NextFunction) {
  try {
    const raw = await prisma.extensionRequest.findMany({
      include: { application: { include: APP_INCLUDE } },
      orderBy: { createdAt: 'desc' },
    });
    const requests = await mergeSupDoc(raw);
    res.json({ requests });
  } catch (e) { next(e); }
}

// POST /api/nodal-a/extension-requests/:id/grant
export async function grantExtensionRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as { id: string };
    const { remarks } = req.body as { remarks?: string };
    const ext = await prisma.extensionRequest.findUnique({ where: { id } });
    if (!ext) throw new AppError('Extension request not found', 404);
    if (ext.status !== 'Pending') throw new AppError('Only pending requests can be actioned', 400);
    await prisma.extensionRequest.update({
      where: { id },
      data:  { status: 'Approved', authorityRemarks: remarks ?? null },
    });
    res.json({ message: 'Extension request granted.' });
  } catch (e) { next(e); }
}

// POST /api/nodal-a/extension-requests/:id/reject
export async function rejectExtensionRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as { id: string };
    const { remarks } = req.body as { remarks?: string };
    const ext = await prisma.extensionRequest.findUnique({ where: { id } });
    if (!ext) throw new AppError('Extension request not found', 404);
    if (ext.status !== 'Pending') throw new AppError('Only pending requests can be actioned', 400);
    await prisma.extensionRequest.update({
      where: { id },
      data:  { status: 'Rejected', authorityRemarks: remarks ?? null },
    });
    res.json({ message: 'Extension request rejected.' });
  } catch (e) { next(e); }
}

// POST /api/nodal-a/extension-requests  →  Nodal A creates an extension request on behalf of applicant
export async function createExtensionRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const { applicationId, reason, extensionDays, contactEmail, justification } = req.body as {
      applicationId: string; reason: string; extensionDays: number; contactEmail: string; justification: string;
    };
    if (!applicationId || !reason || !extensionDays || !justification) throw new AppError('Missing required fields', 400);
    const app = await prisma.application.findUnique({ where: { id: applicationId } });
    if (!app) throw new AppError('Application not found', 404);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ext = await (prisma.extensionRequest as any).create({
      data: {
        applicationId,
        applicantId:   app.applicantId,
        reason,
        extensionDays: Number(extensionDays),
        contactEmail:  contactEmail ?? '',
        justification,
        status: 'Pending',
      },
      include: { application: { include: APP_INCLUDE } },
    });
    res.json({ extension: ext });
  } catch (e) { next(e); }
}

// GET /api/nodal-a/reports/appeals  →  apps that have at least one appeal filed
export async function listAppealsReport(req: Request, res: Response, next: NextFunction) {
  try {
    const applications = await prisma.application.findMany({
      where:   { appeals: { some: {} } },
      include:  APP_INCLUDE,
      orderBy: { updatedAt: 'desc' },
    });
    res.json({ applications });
  } catch (e) { next(e); }
}

// GET /api/nodal-a/reports/reviews  →  apps that have at least one review filed
export async function listReviewsReport(req: Request, res: Response, next: NextFunction) {
  try {
    const applications = await prisma.application.findMany({
      where:   { reviews: { some: {} } },
      include:  APP_INCLUDE,
      orderBy: { updatedAt: 'desc' },
    });
    res.json({ applications });
  } catch (e) { next(e); }
}

// POST /api/nodal-a/applications/:id/forward  →  WithTechnicalOfficer
export async function forwardToTechnical(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params['id'] as string;
    const application = await advanceStage(id, 'WithNodalOfficerA', 'WithTechnicalOfficer');
    res.json({ application });
  } catch (e) { next(e); }
}

// POST /api/nodal-a/applications/:id/send-decision  →  Approved or Rejected (based on TO's recorded decision)
export async function sendDecisionToApplicant(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params['id'] as string;
    const app = await prisma.application.findUnique({ where: { id } });
    if (!app) throw new AppError('Application not found', 404);
    const td = app.toDecision as Record<string, unknown> | null;
    const targetStage = td?.decision === 'Rejected' ? 'Rejected' : 'Approved';
    const application = await advanceStage(id, 'WithNodalOfficerA', targetStage);
    res.json({ application });
  } catch (e) { next(e); }
}

// POST /api/nodal-a/appeals/:id/dispatch  →  Approved (if AppealApproved) or Rejected (if AppealRejected)
export async function dispatchAppealDecision(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params['id'] as string;
    const appeal = await prisma.appeal.findUnique({ where: { id }, include: { application: true } });
    if (!appeal) throw new AppError('Appeal not found', 404);
    if (appeal.status !== 'AppealApproved' && appeal.status !== 'AppealRejected') {
      throw new AppError(`Cannot dispatch: appeal status is "${appeal.status}"`, 400);
    }
    if (appeal.application.stage !== 'WithNodalOfficerA') {
      throw new AppError(`Cannot dispatch: application is in "${appeal.application.stage}"`, 400);
    }
    const targetStage = appeal.status === 'AppealApproved' ? 'Approved' : 'Rejected';
    const application = await advanceStage(appeal.applicationId, 'WithNodalOfficerA', targetStage);
    res.json({ application });
  } catch (e) { next(e); }
}

// PATCH /api/nodal-a/appeals/:id/upload-authority-doc  →  save authority response document URL
export async function uploadAppealAuthorityDoc(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as { id: string };
    const { authorityDocUrl } = req.body as { authorityDocUrl?: string };
    if (!authorityDocUrl?.trim()) throw new AppError('authorityDocUrl is required', 400);
    const appeal = await prisma.appeal.update({ where: { id }, data: { authorityDocUrl } });
    res.json({ appeal });
  } catch (e) { next(e); }
}

// PATCH /api/nodal-a/reviews/:id/upload-authority-doc  →  save authority response document URL
export async function uploadReviewAuthorityDoc(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as { id: string };
    const { authorityDocUrl } = req.body as { authorityDocUrl?: string };
    if (!authorityDocUrl?.trim()) throw new AppError('authorityDocUrl is required', 400);
    const review = await prisma.review.update({ where: { id }, data: { authorityDocUrl } });
    res.json({ review });
  } catch (e) { next(e); }
}

// POST /api/nodal-a/reviews/:id/forward-to-chairperson  →  WithChairperson (Nodal forwards review petition)
export async function forwardReviewToChairperson(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params['id'] as string;
    const review = await prisma.review.findUnique({ where: { id }, include: { application: true } });
    if (!review) throw new AppError('Review not found', 404);
    if (review.status !== 'ReviewPending') throw new AppError(`Cannot forward: review status is "${review.status}"`, 400);
    if (review.application.stage !== 'WithNodalOfficerA') throw new AppError(`Cannot forward: application is in "${review.application.stage}"`, 400);
    const currentTd = (review.application.toDecision as Record<string, unknown>) ?? {};
    const { reviewPendingForward, ...restTd } = currentTd;
    await prisma.application.update({
      where: { id: review.applicationId },
      data: { stage: 'WithChairperson', toDecision: restTd },
    });
    res.json({ success: true });
  } catch (e) { next(e); }
}

// POST /api/nodal-a/reviews/:id/dispatch  →  Rejected (ReviewDisposed — CEO upheld)
export async function dispatchReviewDecision(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params['id'] as string;
    const review = await prisma.review.findUnique({ where: { id }, include: { application: true } });
    if (!review) throw new AppError('Review not found', 404);
    if (review.status !== 'ReviewDisposed') {
      throw new AppError(`Cannot dispatch: review status is "${review.status}"`, 400);
    }
    if (review.application.stage !== 'WithNodalOfficerA') {
      throw new AppError(`Cannot dispatch: application is in "${review.application.stage}"`, 400);
    }
    const application = await advanceStage(review.applicationId, 'WithNodalOfficerA', 'Rejected');
    res.json({ application });
  } catch (e) { next(e); }
}

// ── Withdrawal requests ───────────────────────────────────────────────────────

// GET /api/nodal-a/withdrawal-requests  →  all pending withdrawal requests
export async function listWithdrawalRequests(req: Request, res: Response, next: NextFunction) {
  try {
    const requests = await prisma.withdrawalRequest.findMany({
      include: { application: { include: APP_INCLUDE }, requestedBy: { select: { username: true, email: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ requests });
  } catch (e) { next(e); }
}

// POST /api/nodal-a/withdrawal-requests/:id/approve  →  approve ByApplicant request; advance app to Withdrawn
export async function approveWithdrawalRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const wr = await prisma.withdrawalRequest.findUnique({ where: { id: req.params['id'] as string }, include: { application: true } });
    if (!wr) throw new AppError('Withdrawal request not found', 404);
    if (wr.status !== 'Pending') throw new AppError(`Request already ${wr.status}`, 400);
    await prisma.withdrawalRequest.update({ where: { id: wr.id }, data: { status: 'Approved' } });
    const application = await prisma.application.update({ where: { id: wr.applicationId }, data: { stage: 'Withdrawn' } });
    res.json({ application });
  } catch (e) { next(e); }
}

// POST /api/nodal-a/withdrawal-requests/:id/reject  →  reject ByApplicant request
export async function rejectWithdrawalRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const wr = await prisma.withdrawalRequest.findUnique({ where: { id: req.params['id'] as string } });
    if (!wr) throw new AppError('Withdrawal request not found', 404);
    if (wr.status !== 'Pending') throw new AppError(`Request already ${wr.status}`, 400);
    const request = await prisma.withdrawalRequest.update({ where: { id: wr.id }, data: { status: 'Rejected' } });
    res.json({ request });
  } catch (e) { next(e); }
}

// POST /api/nodal-a/applications/:id/withdraw-by-authority  →  Nodal A directly withdraws an approved app
export async function withdrawByAuthority(req: Request, res: Response, next: NextFunction) {
  try {
    const { justification } = req.body as { justification?: string };
    if (!justification?.trim()) throw new AppError('Justification is required', 400);
    const app = await prisma.application.findUnique({ where: { id: req.params['id'] as string } });
    if (!app) throw new AppError('Application not found', 404);
    if (!['Approved', 'Closed'].includes(app.stage)) throw new AppError('Only approved applications can be withdrawn by authority', 400);
    await prisma.withdrawalRequest.create({
      data: { applicationId: app.id, requestedById: req.user!.userId, type: 'ByAuthority', justification: justification.trim(), status: 'Executed' },
    });
    const application = await prisma.application.update({ where: { id: app.id }, data: { stage: 'WithdrawnByAuthority' } });
    res.json({ application });
  } catch (e) { next(e); }
}
