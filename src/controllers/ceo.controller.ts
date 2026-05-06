import { Request, Response, NextFunction } from 'express';
import { getApplicationsByStage, getAllApplications, advanceStage } from '../services/workflow.service';
import { prisma } from '../config/db';
import { AppError } from '../middleware/errorHandler.middleware';

const APP_INCLUDE = { applicant: { select: { username: true, email: true, licenseNumber: true } } };

// GET /api/ceo/applications  →  WithCEO queue
export async function listPending(req: Request, res: Response, next: NextFunction) {
  try {
    const applications = await getApplicationsByStage('WithCEO');
    res.json({ applications });
  } catch (e) { next(e); }
}

// GET /api/ceo/all
export async function listAll(req: Request, res: Response, next: NextFunction) {
  try {
    const applications = await getAllApplications();
    res.json({ applications });
  } catch (e) { next(e); }
}

// GET /api/ceo/appeals  →  AppealPending queue
export async function listAppeals(req: Request, res: Response, next: NextFunction) {
  try {
    const appeals = await prisma.appeal.findMany({
      where: { status: 'AppealPending' },
      include: {
        application: { include: APP_INCLUDE },
        applicant: { select: { username: true, email: true } },
      },
      orderBy: { filedAt: 'desc' },
    });
    res.json({ appeals });
  } catch (e) { next(e); }
}

// GET /api/ceo/extension-requests
export async function listExtensions(req: Request, res: Response, next: NextFunction) {
  try {
    const requests = await prisma.extensionRequest.findMany({
      include: { application: { include: APP_INCLUDE } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ requests });
  } catch (e) { next(e); }
}

// POST /api/ceo/applications/:id/forward-chairperson  →  WithCEO → WithChairperson
export async function forwardToChairperson(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params['id'] as string;
    const app = await prisma.application.findUnique({ where: { id } });
    if (!app) throw new AppError('Application not found', 404);
    if (app.stage !== 'WithCEO') {
      throw new AppError(`Cannot forward: application is in "${app.stage}"`, 400);
    }
    const application = await advanceStage(id, 'WithCEO', 'WithChairperson');
    res.json({ application });
  } catch (e) { next(e); }
}

// POST /api/ceo/applications/:id/reject  →  Rejected
export async function rejectApplication(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params['id'] as string;
    const { reason } = req.body as { reason?: string };
    if (!reason?.trim()) throw new AppError('Rejection reason is required', 400);
    const app = await prisma.application.findUnique({ where: { id } });
    if (!app) throw new AppError('Application not found', 404);
    if (app.stage !== 'WithCEO') {
      throw new AppError(`Cannot reject: application is in "${app.stage}"`, 400);
    }
    const application = await prisma.application.update({
      where: { id },
      data: { stage: 'Rejected' },
    });
    res.json({ application });
  } catch (e) { next(e); }
}

// POST /api/ceo/appeals/:id/approve  →  AppealApproved
export async function approveAppeal(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params['id'] as string;
    const { decisionRemarks } = req.body as { decisionRemarks?: string };
    if (!decisionRemarks?.trim()) throw new AppError('decisionRemarks is required', 400);
    const appeal = await prisma.appeal.findUnique({ where: { id } });
    if (!appeal) throw new AppError('Appeal not found', 404);
    if (appeal.status !== 'AppealPending') {
      throw new AppError(`Cannot approve: appeal status is "${appeal.status}"`, 400);
    }
    const updated = await prisma.appeal.update({
      where: { id },
      data: { status: 'AppealApproved', decisionRemarks, decisionAt: new Date() },
    });
    res.json({ appeal: updated });
  } catch (e) { next(e); }
}

// POST /api/ceo/appeals/:id/reject  →  AppealRejected
export async function rejectAppeal(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params['id'] as string;
    const { decisionRemarks } = req.body as { decisionRemarks?: string };
    if (!decisionRemarks?.trim()) throw new AppError('decisionRemarks is required', 400);
    const appeal = await prisma.appeal.findUnique({ where: { id } });
    if (!appeal) throw new AppError('Appeal not found', 404);
    if (appeal.status !== 'AppealPending') {
      throw new AppError(`Cannot reject: appeal status is "${appeal.status}"`, 400);
    }
    const updated = await prisma.appeal.update({
      where: { id },
      data: { status: 'AppealRejected', decisionRemarks, decisionAt: new Date() },
    });
    res.json({ appeal: updated });
  } catch (e) { next(e); }
}
