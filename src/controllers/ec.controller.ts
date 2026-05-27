import { Request, Response, NextFunction } from 'express';
import { getApplicationsByStage, getAllApplications, advanceStage } from '../services/workflow.service';
import { generateApprovalNumber } from '../services/application.service';
import { prisma } from '../config/db';
import { AppError } from '../middleware/errorHandler.middleware';
import { mergeSupDoc } from '../services/extension.service';
import { createQuery } from '../services/query.service';
import { ROLES } from '../config/constants';

const APP_INCLUDE = { applicant: { select: { username: true, email: true, licenseNumber: true } } };

// GET /api/ec/all  →  all non-draft applications assigned to this EC member
export async function listAll(req: Request, res: Response, next: NextFunction) {
  try {
    const applications = await getAllApplications(req.user!.userId, 'assignedECId');
    res.json({ applications });
  } catch (e) { next(e); }
}

// GET /api/ec/applications  →  WithExpertCommittee assigned to this EC member
export async function listPending(req: Request, res: Response, next: NextFunction) {
  try {
    const applications = await getApplicationsByStage('WithExpertCommittee', req.user!.userId, 'assignedECId');
    res.json({ applications });
  } catch (e) { next(e); }
}

// GET /api/ec/appeal-review  →  appeal + review records for apps assigned to this EC member
export async function listAppealReview(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const [appeals, reviews] = await Promise.all([
      prisma.appeal.findMany({ where: { application: { assignedECId: userId } }, include: { application: { include: APP_INCLUDE } }, orderBy: { filedAt: 'desc' } }),
      prisma.review.findMany({ where: { application: { assignedECId: userId } }, include: { application: { include: APP_INCLUDE } }, orderBy: { filedAt: 'desc' } }),
    ]);
    const records = [
      ...appeals.map((a) => ({ ...a, type: 'Appeal' as const })),
      ...reviews.map((r) => ({ ...r, type: 'Review' as const })),
    ].sort((a, b) => new Date(b.filedAt).getTime() - new Date(a.filedAt).getTime());
    res.json({ records });
  } catch (e) { next(e); }
}

// GET /api/ec/extension-requests  →  extensions for apps assigned to this EC member
export async function listExtensionRequests(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const raw = await prisma.extensionRequest.findMany({
      where: { application: { assignedECId: userId } },
      include: { application: { include: APP_INCLUDE } },
      orderBy: { createdAt: 'desc' },
    });
    const requests = await mergeSupDoc(raw);
    res.json({ requests });
  } catch (e) { next(e); }
}

// GET /api/ec/reports/appeals
export async function listAppealsReport(req: Request, res: Response, next: NextFunction) {
  try {
    const applications = await prisma.application.findMany({
      where: { appeals: { some: {} }, assignedECId: req.user!.userId }, include: APP_INCLUDE, orderBy: { updatedAt: 'desc' },
    });
    res.json({ applications });
  } catch (e) { next(e); }
}

// GET /api/ec/reports/reviews
export async function listReviewsReport(req: Request, res: Response, next: NextFunction) {
  try {
    const applications = await prisma.application.findMany({
      where: { reviews: { some: {} }, assignedECId: req.user!.userId }, include: APP_INCLUDE, orderBy: { updatedAt: 'desc' },
    });
    res.json({ applications });
  } catch (e) { next(e); }
}

// POST /api/ec/applications/:id/forward-technical  →  WithExpertCommittee → WithTechnicalOfficer (uses assignedTOId)
export async function forwardToTechnicalOfficer(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params['id'] as string;
    const app = await prisma.application.findUnique({ where: { id } });
    if (!app) throw new AppError('Application not found', 404);
    if (app.stage !== 'WithExpertCommittee') throw new AppError(`Cannot forward: application is in "${app.stage}"`, 400);
    if (!app.assignedTOId) throw new AppError('No Technical Officer assigned to this application', 400);
    const approvalNumber = await generateApprovalNumber(app.applicationType, app.foodCategory, true);
    const application = await prisma.application.update({
      where: { id },
      data: { stage: 'WithTechnicalOfficer', approvalNumber, toDecision: { fromEC: true, ecDecision: 'RecommendApproval', forwardedAt: new Date().toISOString() } },
    });
    res.json({ application });
  } catch (e) { next(e); }
}

// POST /api/ec/applications/:id/reject  →  WithExpertCommittee → WithTechnicalOfficer (EC recommends rejection)
export async function rejectApplication(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params['id'] as string;
    const { reason } = req.body as { reason?: string };
    if (!reason?.trim()) throw new AppError('Rejection reason is required', 400);
    const app = await prisma.application.findUnique({ where: { id } });
    if (!app) throw new AppError('Application not found', 404);
    if (app.stage !== 'WithExpertCommittee') {
      throw new AppError(`Cannot record rejection: application is in "${app.stage}"`, 400);
    }
    if (!app.assignedTOId) throw new AppError('No Technical Officer assigned to this application', 400);
    const approvalNumber = await generateApprovalNumber(app.applicationType, app.foodCategory, false);
    const application = await prisma.application.update({
      where: { id },
      data: { stage: 'WithTechnicalOfficer', approvalNumber, toDecision: { fromEC: true, ecDecision: 'RecommendRejection', ecRemarks: reason, forwardedAt: new Date().toISOString() } },
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

// POST /api/ec/extension-requests/:id/grant
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
    if (ext.application.assignedECId !== req.user!.userId) throw new AppError('Not authorized to action this extension', 403);
    await prisma.extensionRequest.update({
      where: { id },
      data:  { status: 'Approved', authorityRemarks: remarks ?? null },
    });
    res.json({ message: 'Extension request granted.' });
  } catch (e) { next(e); }
}

// POST /api/ec/extension-requests/:id/reject
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
    if (ext.application.assignedECId !== req.user!.userId) throw new AppError('Not authorized to action this extension', 403);
    await prisma.extensionRequest.update({
      where: { id },
      data:  { status: 'Rejected', authorityRemarks: remarks ?? null },
    });
    res.json({ message: 'Extension request rejected.' });
  } catch (e) { next(e); }
}

// POST /api/ec/applications/:id/clarify  →  WithNodalOfficerA (EC query routed via Nodal A, same pattern as TO queries)
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
    await prisma.$transaction([
      prisma.query.create({
        data: {
          applicationId: id,
          text,
          askedById: req.user!.userId,
          originStage: 'WithExpertCommittee',
          revertedFromStage: 'WithNodalOfficerA',
        },
      }),
      prisma.application.update({ where: { id }, data: { stage: 'WithNodalOfficerA' } }),
    ]);
    res.json({ message: 'Clarification requested — application forwarded to Nodal Officer A.' });
  } catch (e) { next(e); }
}
