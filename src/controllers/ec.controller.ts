import { Request, Response, NextFunction } from 'express';
import { getApplicationsByStage, getAllApplications, advanceStage } from '../services/workflow.service';
import { prisma } from '../config/db';
import { AppError } from '../middleware/errorHandler.middleware';

const APP_INCLUDE = { applicant: { select: { username: true, email: true, licenseNumber: true } } };

// GET /api/ec/all
export async function listAll(req: Request, res: Response, next: NextFunction) {
  try {
    const applications = await getAllApplications();
    res.json({ applications });
  } catch (e) { next(e); }
}

// GET /api/ec/applications  →  WithExpertCommittee queue
export async function listPending(req: Request, res: Response, next: NextFunction) {
  try {
    const applications = await getApplicationsByStage('WithExpertCommittee');
    res.json({ applications });
  } catch (e) { next(e); }
}

// GET /api/ec/appeal-review
export async function listAppealReview(req: Request, res: Response, next: NextFunction) {
  try {
    const [appeals, reviews] = await Promise.all([
      prisma.appeal.findMany({ include: { application: { include: APP_INCLUDE } }, orderBy: { filedAt: 'desc' } }),
      prisma.review.findMany({ include: { application: { include: APP_INCLUDE } }, orderBy: { filedAt: 'desc' } }),
    ]);
    const records = [
      ...appeals.map((a) => ({ ...a, type: 'Appeal' as const })),
      ...reviews.map((r) => ({ ...r, type: 'Review' as const })),
    ].sort((a, b) => new Date(b.filedAt).getTime() - new Date(a.filedAt).getTime());
    res.json({ records });
  } catch (e) { next(e); }
}

// GET /api/ec/extension-requests
export async function listExtensionRequests(req: Request, res: Response, next: NextFunction) {
  try {
    const requests = await prisma.extensionRequest.findMany({
      include: { application: { include: APP_INCLUDE } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ requests });
  } catch (e) { next(e); }
}

// GET /api/ec/reports/appeals
export async function listAppealsReport(req: Request, res: Response, next: NextFunction) {
  try {
    const applications = await prisma.application.findMany({
      where: { appeals: { some: {} } }, include: APP_INCLUDE, orderBy: { updatedAt: 'desc' },
    });
    res.json({ applications });
  } catch (e) { next(e); }
}

// GET /api/ec/reports/reviews
export async function listReviewsReport(req: Request, res: Response, next: NextFunction) {
  try {
    const applications = await prisma.application.findMany({
      where: { reviews: { some: {} } }, include: APP_INCLUDE, orderBy: { updatedAt: 'desc' },
    });
    res.json({ applications });
  } catch (e) { next(e); }
}

// POST /api/ec/applications/:id/forward-nodalb  →  WithExpertCommittee → WithNodalPointB
export async function forwardToNodalB(req: Request, res: Response, next: NextFunction) {
  try {
    const application = await advanceStage(req.params['id'] as string, 'WithExpertCommittee', 'WithNodalPointB');
    res.json({ application });
  } catch (e) { next(e); }
}

// POST /api/ec/applications/:id/reject  →  Rejected
export async function rejectApplication(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params['id'] as string;
    const { reason } = req.body as { reason?: string };
    if (!reason?.trim()) throw new AppError('Rejection reason is required', 400);
    const app = await prisma.application.findUnique({ where: { id } });
    if (!app) throw new AppError('Application not found', 404);
    if (app.stage !== 'WithExpertCommittee') {
      throw new AppError(`Cannot reject: application is in "${app.stage}"`, 400);
    }
    const application = await prisma.application.update({
      where: { id },
      data: { stage: 'Rejected' },
    });
    res.json({ application });
  } catch (e) { next(e); }
}

// PATCH /api/ec/applications/:id/assessment  →  save EC checklist + notes
export async function saveAssessment(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params['id'] as string;
    const { checklist, notes } = req.body as { checklist?: Record<string, boolean>; notes?: string };
    if (!checklist || typeof checklist !== 'object') throw new AppError('checklist is required', 400);
    const app = await prisma.application.findUnique({ where: { id } });
    if (!app) throw new AppError('Application not found', 404);
    const updated = await prisma.application.update({
      where: { id },
      data: { ecAssessment: { checklist, notes: notes ?? '' } },
    });
    res.json({ ecAssessment: updated.ecAssessment });
  } catch (e) { next(e); }
}

// POST /api/ec/applications/:id/clarify  →  QuerySent (EC requests clarification from applicant via NA)
export async function requestClarification(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params['id'] as string;
    const { text } = req.body as { text?: string };
    if (!text?.trim()) throw new AppError('Clarification text is required', 400);
    const app = await prisma.application.findUnique({ where: { id } });
    if (!app) throw new AppError('Application not found', 404);
    if (app.stage !== 'WithExpertCommittee') {
      throw new AppError(`Cannot request clarification: application is in "${app.stage}"`, 400);
    }
    const userId = (req as Request & { user?: { id: string } }).user?.id;
    await prisma.$transaction([
      prisma.query.create({
        data: { applicationId: id, text, askedById: userId ?? '', originStage: 'WithExpertCommittee', revertedFromStage: 'WithExpertCommittee' },
      }),
      prisma.application.update({ where: { id }, data: { stage: 'QuerySent' } }),
    ]);
    res.json({ message: 'Clarification requested. Application stage set to QuerySent.' });
  } catch (e) { next(e); }
}
