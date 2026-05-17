import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { listExtensions, createExtension, updateExtension } from '../services/extension.service';
import { AppError } from '../middleware/errorHandler.middleware';

const extSchema = z.object({
  applicationId: z.string().uuid(),
  reason:        z.string().min(1),
  extensionDays: z.number().int().positive(),
  contactEmail:  z.string().email().or(z.literal('')),
  justification: z.string().min(10),
  queryId:       z.string().uuid().optional(),
});

const extUpdateSchema = z.object({
  reason:        z.string().min(1),
  extensionDays: z.number().int().positive(),
  contactEmail:  z.string().email(),
  justification: z.string().min(10),
});

// GET /api/extensions
export async function getExtensions(req: Request, res: Response, next: NextFunction) {
  try {
    const items = await listExtensions(req.user!.userId);
    res.json({ items });
  } catch (e) { next(e); }
}

// POST /api/extensions
export async function createExt(req: Request, res: Response, next: NextFunction) {
  try {
    const body = extSchema.safeParse(req.body);
    if (!body.success) throw new AppError(body.error.errors[0].message, 422);
    const { applicationId, reason, extensionDays, contactEmail, justification, queryId } = body.data;
    const ext = await createExtension(req.user!.userId, applicationId, reason, extensionDays, contactEmail, justification, queryId);
    res.status(201).json({ extension: ext });
  } catch (e) { next(e); }
}

// PUT /api/extensions/:id
export async function updateExt(req: Request, res: Response, next: NextFunction) {
  try {
    const body = extUpdateSchema.safeParse(req.body);
    if (!body.success) throw new AppError(body.error.errors[0].message, 422);
    const { reason, extensionDays, contactEmail, justification } = body.data;
    const ext = await updateExtension(req.params['id'] as string, req.user!.userId, reason, extensionDays, contactEmail, justification);
    res.json({ extension: ext });
  } catch (e) { next(e); }
}
