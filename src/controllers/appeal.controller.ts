import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { listAppeals, fileAppeal, listReviews, fileReview } from '../services/appeal.service';
import { AppError } from '../middleware/errorHandler.middleware';

const appealSchema = z.object({
  applicationId: z.string().uuid(),
  grounds:       z.string().min(10, 'Grounds must be at least 10 characters'),
});

const reviewSchema = z.object({
  appealId: z.string().uuid(),
  grounds:  z.string().min(10, 'Grounds must be at least 10 characters'),
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
    const body = appealSchema.safeParse(req.body);
    if (!body.success) throw new AppError(body.error.errors[0].message, 422);
    const appeal = await fileAppeal(req.user!.userId, body.data.applicationId, body.data.grounds);
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
    const review = await fileReview(req.user!.userId, body.data.appealId, body.data.grounds);
    res.status(201).json({ review });
  } catch (e) { next(e); }
}
