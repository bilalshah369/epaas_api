import { Request, Response, NextFunction } from 'express';
import { getApplicationsByStage, getAllApplications } from '../services/workflow.service';
import { prisma } from '../config/db';
import { AppError } from '../middleware/errorHandler.middleware';

const APP_INCLUDE = { applicant: { select: { username: true, email: true, licenseNumber: true } } };

// GET /api/chairperson/applications  →  WithChairperson queue
export async function listPending(req: Request, res: Response, next: NextFunction) {
  try {
    const applications = await getApplicationsByStage('WithChairperson');
    res.json({ applications });
  } catch (e) { next(e); }
}

// GET /api/chairperson/all
export async function listAll(req: Request, res: Response, next: NextFunction) {
  try {
    const applications = await getAllApplications();
    res.json({ applications });
  } catch (e) { next(e); }
}

// GET /api/chairperson/reviews  →  ReviewPending queue
export async function listReviews(req: Request, res: Response, next: NextFunction) {
  try {
    const reviews = await prisma.review.findMany({
      where: { status: 'ReviewPending' },
      include: {
        application: { include: APP_INCLUDE },
        applicant: { select: { username: true, email: true } },
        appeal: true,
      },
      orderBy: { filedAt: 'desc' },
    });
    res.json({ reviews });
  } catch (e) { next(e); }
}

// GET /api/chairperson/extension-requests
export async function listExtensions(req: Request, res: Response, next: NextFunction) {
  try {
    const requests = await prisma.extensionRequest.findMany({
      include: { application: { include: APP_INCLUDE } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ requests });
  } catch (e) { next(e); }
}

// POST /api/chairperson/applications/:id/approve  →  Approved
export async function approveApplication(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params['id'] as string;
    const { remarks } = req.body as { remarks?: string };
    if (!remarks?.trim()) throw new AppError('Remarks are required', 400);
    const app = await prisma.application.findUnique({ where: { id } });
    if (!app) throw new AppError('Application not found', 404);
    if (app.stage !== 'WithChairperson') {
      throw new AppError(`Cannot approve: application is in "${app.stage}"`, 400);
    }
    const application = await prisma.application.update({
      where: { id },
      data: { stage: 'Approved' },
    });
    res.json({ application });
  } catch (e) { next(e); }
}

// POST /api/chairperson/applications/:id/reject  →  Rejected
export async function rejectApplication(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params['id'] as string;
    const { reason } = req.body as { reason?: string };
    if (!reason?.trim()) throw new AppError('Rejection reason is required', 400);
    const app = await prisma.application.findUnique({ where: { id } });
    if (!app) throw new AppError('Application not found', 404);
    if (app.stage !== 'WithChairperson') {
      throw new AppError(`Cannot reject: application is in "${app.stage}"`, 400);
    }
    const application = await prisma.application.update({
      where: { id },
      data: { stage: 'Rejected' },
    });
    res.json({ application });
  } catch (e) { next(e); }
}

// POST /api/chairperson/reviews/:id/dispose  →  ReviewDisposed
export async function disposeReview(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params['id'] as string;
    const { decisionRemarks } = req.body as { decisionRemarks?: string };
    if (!decisionRemarks?.trim()) throw new AppError('decisionRemarks is required', 400);
    const review = await prisma.review.findUnique({ where: { id } });
    if (!review) throw new AppError('Review not found', 404);
    if (review.status !== 'ReviewPending') {
      throw new AppError(`Cannot dispose: review status is "${review.status}"`, 400);
    }
    const updated = await prisma.review.update({
      where: { id },
      data: { status: 'ReviewDisposed', decisionRemarks, decisionAt: new Date() },
    });
    res.json({ review: updated });
  } catch (e) { next(e); }
}
