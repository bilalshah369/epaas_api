import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { getApplicationsByStage, getAllApplications, advanceStage, getEligibleOfficers } from '../services/workflow.service';
import { prisma } from '../config/db';
import { AppError } from '../middleware/errorHandler.middleware';
import { mergeSupDoc } from '../services/extension.service';
import { ROLES } from '../config/constants';

const APP_INCLUDE = { applicant: { select: { username: true, email: true, licenseNumber: true } } };

// GET /api/technical/all  →  all non-draft applications assigned to this TO
export async function listAll(req: Request, res: Response, next: NextFunction) {
  try {
    const applications = await getAllApplications(req.user!.userId, 'assignedTOId');
    res.json({ applications });
  } catch (e) { next(e); }
}

// GET /api/technical/appeal-review  →  appeal + review records for apps assigned to this TO
export async function listAppealReview(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const [appeals, reviews] = await Promise.all([
      prisma.appeal.findMany({ where: { application: { assignedTOId: userId } }, include: { application: { include: APP_INCLUDE } }, orderBy: { filedAt: 'desc' } }),
      prisma.review.findMany({ where: { application: { assignedTOId: userId } }, include: { application: { include: APP_INCLUDE } }, orderBy: { filedAt: 'desc' } }),
    ]);
    const records = [
      ...appeals.map((a) => ({ ...a, type: 'Appeal' as const })),
      ...reviews.map((r) => ({ ...r, type: 'Review' as const })),
    ].sort((a, b) => new Date(b.filedAt).getTime() - new Date(a.filedAt).getTime());
    res.json({ records });
  } catch (e) { next(e); }
}

// GET /api/technical/extension-requests  →  extensions for apps assigned to this TO where query was raised by TO
export async function listExtensionRequests(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const raw = await (prisma.extensionRequest as any).findMany({
      where: {
        application: { assignedTOId: userId },
        query: { originStage: 'WithTechnicalOfficer' },
      },
      include: { application: { include: APP_INCLUDE } },
      orderBy: { createdAt: 'desc' },
    });
    const requests = await mergeSupDoc(raw);
    res.json({ requests });
  } catch (e) { next(e); }
}

// POST /api/technical/extension-requests/:id/grant
export async function grantExtensionRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as { id: string };
    const { remarks } = req.body as { remarks?: string };
    const ext = await (prisma.extensionRequest as any).findUnique({
      where: { id },
      include: { application: true, query: true },
    });
    if (!ext) throw new AppError('Extension request not found', 404);
    if (ext.status !== 'Pending') throw new AppError('Only pending requests can be actioned', 400);
    if (ext.application.assignedTOId !== req.user!.userId) throw new AppError('Not authorized to action this extension', 403);
    if (ext.query?.originStage !== 'WithTechnicalOfficer') throw new AppError('This extension is not owned by the Technical Officer', 403);
    await prisma.extensionRequest.update({
      where: { id },
      data:  { status: 'Approved', authorityRemarks: remarks ?? null },
    });
    res.json({ message: 'Extension request granted.' });
  } catch (e) { next(e); }
}

// POST /api/technical/extension-requests/:id/reject
export async function rejectExtensionRequest(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params as { id: string };
    const { remarks } = req.body as { remarks?: string };
    const ext = await (prisma.extensionRequest as any).findUnique({
      where: { id },
      include: { application: true, query: true },
    });
    if (!ext) throw new AppError('Extension request not found', 404);
    if (ext.status !== 'Pending') throw new AppError('Only pending requests can be actioned', 400);
    if (ext.application.assignedTOId !== req.user!.userId) throw new AppError('Not authorized to action this extension', 403);
    if (ext.query?.originStage !== 'WithTechnicalOfficer') throw new AppError('This extension is not owned by the Technical Officer', 403);
    await prisma.extensionRequest.update({
      where: { id },
      data:  { status: 'Rejected', authorityRemarks: remarks ?? null },
    });
    res.json({ message: 'Extension request rejected.' });
  } catch (e) { next(e); }
}

// GET /api/technical/reports/appeals
export async function listAppealsReport(req: Request, res: Response, next: NextFunction) {
  try {
    const applications = await prisma.application.findMany({
      where: { appeals: { some: {} }, assignedTOId: req.user!.userId }, include: APP_INCLUDE, orderBy: { updatedAt: 'desc' },
    });
    res.json({ applications });
  } catch (e) { next(e); }
}

// GET /api/technical/reports/reviews
export async function listReviewsReport(req: Request, res: Response, next: NextFunction) {
  try {
    const applications = await prisma.application.findMany({
      where: { reviews: { some: {} }, assignedTOId: req.user!.userId }, include: APP_INCLUDE, orderBy: { updatedAt: 'desc' },
    });
    res.json({ applications });
  } catch (e) { next(e); }
}

// GET /api/technical/applications  →  WithTechnicalOfficer assigned to this TO
export async function listPending(req: Request, res: Response, next: NextFunction) {
  try {
    const applications = await getApplicationsByStage('WithTechnicalOfficer', req.user!.userId, 'assignedTOId');
    res.json({ applications });
  } catch (e) { next(e); }
}

// GET /api/technical/applications/:id/eligible-ec  →  ECs eligible for this application's category
export async function eligibleEC(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params['id'] as string;
    const app = await prisma.application.findUnique({ where: { id } });
    if (!app) throw new AppError('Application not found', 404);
    const officers = await getEligibleOfficers(ROLES.EXPERT_COMMITTEE, app.applicationType);
    res.json({ officers });
  } catch (e) { next(e); }
}

// POST /api/technical/applications/:id/forward-ec  →  WithExpertCommittee, assign EC
export async function forwardToEC(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params['id'] as string;
    const { ecId } = req.body as { ecId?: string };
    if (!ecId?.trim()) throw new AppError('ecId (Expert Committee member ID) is required', 400);
    const ec = await prisma.user.findUnique({ where: { id: ecId }, include: { role: true } });
    if (!ec || ec.role.roleCode !== ROLES.EXPERT_COMMITTEE) throw new AppError('Invalid Expert Committee member', 400);
    await advanceStage(id, 'WithTechnicalOfficer', 'WithExpertCommittee');
    const application = await prisma.application.update({ where: { id }, data: { assignedECId: ecId } });
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
    res.json({ message: 'Clarification requested. Application routed to Nodal Officer for forwarding.' });
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
