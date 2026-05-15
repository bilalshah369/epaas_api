import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { listAppeals, fileAppeal, listReviews, fileReview } from '../services/appeal.service';
import { AppError } from '../middleware/errorHandler.middleware';

const appealSchema = z.object({
  applicationId: z.string().min(1),
  grounds:       z.string().min(1, 'Grounds for appeal are required'),
  attachmentUrl: z.string().optional().nullable(),
});

const reviewSchema = z.object({
  appealId:      z.string().min(1),
  grounds:       z.string().min(1, 'Grounds for review are required'),
  attachmentUrl: z.string().optional().nullable(),
});

// GET /api/appeals
export async function getAppeals(req: Request, res: Response, next: NextFunction) {
  try {
    const items = await listAppeals(req.user!.userId);
    res.json({ items });
  } catch (e) { next(e); }
}

// POST /api/appeals
export async function createAppeal(req: Request, res: Response, next: NextFunction) {
  try {
    console.log('[appeal] req.body:', JSON.stringify(req.body));
    const body = appealSchema.safeParse(req.body);
    if (!body.success) {
      console.error('[appeal] Zod validation failed:', JSON.stringify(body.error.errors));
      throw new AppError(body.error.errors.map((e) => e.message).join('; '), 422);
    }
    const appeal = await fileAppeal(req.user!.userId, body.data.applicationId, body.data.grounds, body.data.attachmentUrl ?? undefined);
    res.status(201).json({ appeal });
  } catch (e) { next(e); }
}

// GET /api/reviews
export async function getReviews(req: Request, res: Response, next: NextFunction) {
  try {
    const items = await listReviews(req.user!.userId);
    res.json({ items });
  } catch (e) { next(e); }
}

// POST /api/reviews
export async function createReview(req: Request, res: Response, next: NextFunction) {
  try {
    const body = reviewSchema.safeParse(req.body);
    if (!body.success) throw new AppError(body.error.errors[0].message, 422);
    const review = await fileReview(req.user!.userId, body.data.appealId, body.data.grounds, body.data.attachmentUrl ?? undefined);
    res.status(201).json({ review });
  } catch (e) { next(e); }
}
