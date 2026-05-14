import { Request, Response, NextFunction } from 'express';
import { getApplicationsByStage, getAllApplications, advanceStage } from '../services/workflow.service';
import { prisma } from '../config/db';
import { AppError } from '../middleware/errorHandler.middleware';

const APP_INCLUDE = { applicant: { select: { username: true, email: true, licenseNumber: true } } };

// GET /api/nodal-b/applications  →  WithNodalPointB queue
export async function listPending(req: Request, res: Response, next: NextFunction) {
  try {
    const applications = await getApplicationsByStage('WithNodalPointB');
    res.json({ applications });
  } catch (e) { next(e); }
}

// GET /api/nodal-b/all
export async function listAll(req: Request, res: Response, next: NextFunction) {
  try {
    const applications = await getAllApplications();
    res.json({ applications });
  } catch (e) { next(e); }
}

// GET /api/nodal-b/appeals
export async function listAppeals(req: Request, res: Response, next: NextFunction) {
  try {
    const appeals = await prisma.appeal.findMany({
      include: { application: { include: APP_INCLUDE } },
      orderBy: { filedAt: 'desc' },
    });
    res.json({ appeals });
  } catch (e) { next(e); }
}

// GET /api/nodal-b/extension-requests
export async function listExtensions(req: Request, res: Response, next: NextFunction) {
  try {
    const requests = await prisma.extensionRequest.findMany({
      include: { application: { include: APP_INCLUDE } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ requests });
  } catch (e) { next(e); }
}

// POST /api/nodal-b/applications/:id/upload-ec-decision  →  WithNodalPointB → WithTechnicalOfficer
export async function uploadECDecision(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params['id'] as string;
    const app = await prisma.application.findUnique({ where: { id } });
    if (!app) throw new AppError('Application not found', 404);
    if (app.stage !== 'WithNodalPointB') {
      throw new AppError(`Cannot upload EC decision: application is in "${app.stage}"`, 400);
    }
    const application = await advanceStage(id, 'WithNodalPointB', 'WithTechnicalOfficer');
    res.json({ application });
  } catch (e) { next(e); }
}

// POST /api/nodal-b/applications/:id/reject  →  Rejected
export async function rejectApplication(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params['id'] as string;
    const { reason } = req.body as { reason?: string };
    if (!reason?.trim()) throw new AppError('Rejection reason is required', 400);
    const app = await prisma.application.findUnique({ where: { id } });
    if (!app) throw new AppError('Application not found', 404);
    if (app.stage !== 'WithNodalPointB') {
      throw new AppError(`Cannot reject: application is in "${app.stage}"`, 400);
    }
    const application = await prisma.application.update({
      where: { id },
      data: { stage: 'Rejected' },
    });
    res.json({ application });
  } catch (e) { next(e); }
}
