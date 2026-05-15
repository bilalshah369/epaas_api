import { Request, Response, NextFunction } from 'express';
import { getApplicationsByStage, getAllApplications, advanceStage } from '../services/workflow.service';
import { prisma } from '../config/db';
import { AppError } from '../middleware/errorHandler.middleware';

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
    const requests = await prisma.extensionRequest.findMany({
      include: { application: { include: APP_INCLUDE } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ requests });
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

// POST /api/nodal-a/applications/:id/send-decision  →  Approved (post-EC comm letter path)
export async function sendDecisionToApplicant(req: Request, res: Response, next: NextFunction) {
  try {
    const application = await advanceStage(req.params['id'] as string, 'WithNodalOfficerA', 'Approved');
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
