import { Request, Response, NextFunction } from 'express';
import { getApplicationsByStage, getAllApplications } from '../services/workflow.service';
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

// POST /api/ceo/appeals/:id/approve  →  AppealApproved + application → WithNodalOfficerA
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
    const [updated] = await prisma.$transaction([
      prisma.appeal.update({ where: { id }, data: { status: 'AppealApproved', decisionRemarks, decisionAt: new Date() } }),
      prisma.application.update({ where: { id: appeal.applicationId }, data: { stage: 'WithNodalOfficerA' } }),
    ]);
    res.json({ appeal: updated });
  } catch (e) { next(e); }
}

// POST /api/ceo/appeals/:id/reject  →  AppealRejected + application → WithNodalOfficerA
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
    const [updated] = await prisma.$transaction([
      prisma.appeal.update({ where: { id }, data: { status: 'AppealRejected', decisionRemarks, decisionAt: new Date() } }),
      prisma.application.update({ where: { id: appeal.applicationId }, data: { stage: 'WithNodalOfficerA' } }),
    ]);
    res.json({ appeal: updated });
  } catch (e) { next(e); }
}
