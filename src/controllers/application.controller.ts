import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  getMyApplications,
  getApplication,
  createDraft,
  saveDraft,
  submitApplication,
  deleteDraft,
} from '../services/application.service';
import { AppError } from '../middleware/errorHandler.middleware';

const createSchema = z.object({
  applicationType: z.string().min(1),
  companyName:     z.string().min(1),
});

const saveSchema = z.object({
  formData:    z.record(z.unknown()),
  productName: z.string().optional(),
});

export async function myApplications(req: Request, res: Response, next: NextFunction) {
  try {
    const { applicationType, workflowType, stage } = req.query as Record<string, string | undefined>;
    res.json({ applications: await getMyApplications(req.user!.userId, { applicationType, workflowType, stage }) });
  } catch (err) { next(err); }
}

export async function getOne(req: Request, res: Response, next: NextFunction) {
  try {
    // Applicants can only see their own; officers can see any
    const applicantId = req.user!.roleCode === 'Applicant' ? req.user!.userId : undefined;
    res.json({ application: await getApplication(req.params.id as string, applicantId) });
  } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const body = createSchema.safeParse(req.body);
    if (!body.success) throw new AppError(body.error.errors[0].message, 422);
    const app = await createDraft(req.user!.userId, body.data.applicationType, body.data.companyName);
    res.status(201).json({ application: app });
  } catch (err) { next(err); }
}

export async function save(req: Request, res: Response, next: NextFunction) {
  try {
    const body = saveSchema.safeParse(req.body);
    if (!body.success) throw new AppError(body.error.errors[0].message, 422);
    const app = await saveDraft(req.params.id as string, req.user!.userId, body.data.formData, body.data.productName);
    res.json({ application: app });
  } catch (err) { next(err); }
}

export async function submit(req: Request, res: Response, next: NextFunction) {
  try {
    const app = await submitApplication(req.params.id as string, req.user!.userId);
    res.json({ application: app });
  } catch (err) { next(err); }
}

export async function deleteDraftApp(req: Request, res: Response, next: NextFunction) {
  try {
    await deleteDraft(req.params.id as string, req.user!.userId);
    res.json({ success: true });
  } catch (err) { next(err); }
}
