import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { getApplicationsByStage, getAllApplications, advanceStage } from '../services/workflow.service';
import { prisma } from '../config/db';
import { AppError } from '../middleware/errorHandler.middleware';

const APP_INCLUDE = { applicant: { select: { username: true, email: true, licenseNumber: true } } };

// GET /api/technical/all  →  all non-draft applications
export async function listAll(req: Request, res: Response, next: NextFunction) {
  try {
    const applications = await getAllApplications();
    res.json({ applications });
  } catch (e) { next(e); }
}

// GET /api/technical/appeal-review  →  combined appeal + review records
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

// GET /api/technical/extension-requests  →  all extension requests
export async function listExtensionRequests(req: Request, res: Response, next: NextFunction) {
  try {
    const requests = await prisma.extensionRequest.findMany({
      include: { application: { include: APP_INCLUDE } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ requests });
  } catch (e) { next(e); }
}

// GET /api/technical/reports/appeals
export async function listAppealsReport(req: Request, res: Response, next: NextFunction) {
  try {
    const applications = await prisma.application.findMany({
      where: { appeals: { some: {} } }, include: APP_INCLUDE, orderBy: { updatedAt: 'desc' },
    });
    res.json({ applications });
  } catch (e) { next(e); }
}

// GET /api/technical/reports/reviews
export async function listReviewsReport(req: Request, res: Response, next: NextFunction) {
  try {
    const applications = await prisma.application.findMany({
      where: { reviews: { some: {} } }, include: APP_INCLUDE, orderBy: { updatedAt: 'desc' },
    });
    res.json({ applications });
  } catch (e) { next(e); }
}

// GET /api/technical/applications
export async function listPending(req: Request, res: Response, next: NextFunction) {
  try {
    const applications = await getApplicationsByStage('WithTechnicalOfficer');
    res.json({ applications });
  } catch (e) { next(e); }
}

// POST /api/technical/applications/:id/forward-ec  →  WithExpertCommittee
export async function forwardToEC(req: Request, res: Response, next: NextFunction) {
  try {
    const application = await advanceStage(req.params['id'] as string, 'WithTechnicalOfficer', 'WithExpertCommittee');
    res.json({ application });
  } catch (e) { next(e); }
}

// POST /api/technical/applications/:id/request-clarification
// Stage: WithTechnicalOfficer → WithNodalOfficerA (Nodal forwards to applicant, then forwards response back)
export async function requestClarification(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params['id'] as string;
    const { text } = req.body as { text?: string };
    if (!text?.trim()) throw new AppError('Clarification text is required', 400);
    const app = await prisma.application.findUnique({ where: { id } });
    if (!app) throw new AppError('Application not found', 404);
    if (app.stage !== 'WithTechnicalOfficer') {
      throw new AppError(`Cannot request clarification: application is in "${app.stage}"`, 400);
    }
    const userId = req.user!.userId;
    await prisma.$transaction([
      prisma.query.create({
        data: { applicationId: id, text, askedById: userId, originStage: 'WithTechnicalOfficer', revertedFromStage: 'WithNodalOfficerA' },
      }),
      prisma.application.update({ where: { id }, data: { stage: 'WithNodalOfficerA' } }),
    ]);
    res.json({ message: 'Clarification requested. Application routed to Nodal Officer A for forwarding.' });
  } catch (e) { next(e); }
}

// POST /api/technical/applications/:id/record-decision  →  save Form 2 data + WithNodalOfficerA
export async function recordDecision(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params['id'] as string;
    const { decision, conditions, reasons, form2Data, withPms } = req.body as {
      decision?: string; conditions?: string; reasons?: string; form2Data?: Record<string, unknown>; withPms?: boolean;
    };
    if (!decision) throw new AppError('Decision (Approved/Rejected) is required', 400);
    const app = await prisma.application.findUnique({ where: { id } });
    if (!app) throw new AppError('Application not found', 404);
    if (app.stage !== 'WithTechnicalOfficer') {
      throw new AppError(`Cannot record decision: application is in "${app.stage}"`, 400);
    }
    const existing = (app.toDecision as Record<string, unknown>) ?? {};
    const toDecision = { ...existing, decision, conditions: conditions ?? '', reasons: reasons ?? '', form2Data: form2Data ?? {}, withPms: decision === 'Approved' ? (withPms ?? false) : false, recordedAt: new Date().toISOString() };
    const application = await prisma.application.update({
      where: { id },
      data: { toDecision: toDecision as Prisma.InputJsonValue, stage: 'WithNodalOfficerA' },
    });
    res.json({ application });
  } catch (e) { next(e); }
}

// POST /api/technical/applications/:id/reject  →  Rejected
export async function rejectApplication(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params['id'] as string;
    const { reason } = req.body as { reason?: string };
    if (!reason?.trim()) throw new AppError('Rejection reason is required', 400);
    const app = await prisma.application.findUnique({ where: { id } });
    if (!app) throw new AppError('Application not found', 404);
    if (app.stage !== 'WithTechnicalOfficer') {
      throw new AppError(`Cannot reject: application is in "${app.stage}"`, 400);
    }
    const application = await prisma.application.update({
      where: { id },
      data:  { stage: 'Rejected' },
    });
    res.json({ application });
  } catch (e) { next(e); }
}
