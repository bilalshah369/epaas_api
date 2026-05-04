import { Request, Response, NextFunction } from 'express';
import { getApplicationsByStage, getAllApplications, advanceStage } from '../services/workflow.service';
import { prisma } from '../config/db';

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
