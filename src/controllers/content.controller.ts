import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db';

// ── Circulars ──────────────────────────────────────────────────────────────

export async function listCirculars(_req: Request, res: Response, next: NextFunction) {
  try {
    const circulars = await prisma.circular.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
    res.json({ circulars });
  } catch (err) { next(err); }
}

export async function createCircular(req: Request, res: Response, next: NextFunction) {
  try {
    const { date, refNumber, title, tag, published, sortOrder } = req.body;
    if (!date || !refNumber || !title) {
      res.status(400).json({ error: 'date, refNumber and title are required' });
      return;
    }
    const circular = await prisma.circular.create({
      data: { date, refNumber, title, tag: tag ?? 'General', published: published ?? true, sortOrder: sortOrder ?? 0 },
    });
    res.status(201).json({ circular });
  } catch (err) { next(err); }
}

export async function updateCircular(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const { date, refNumber, title, tag, published, sortOrder } = req.body;
    const circular = await prisma.circular.update({
      where: { id },
      data: { date, refNumber, title, tag, published, sortOrder },
    });
    res.json({ circular });
  } catch (err) { next(err); }
}

export async function deleteCircular(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    await prisma.circular.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) { next(err); }
}

// ── Notifications ──────────────────────────────────────────────────────────

export async function listNotifications(_req: Request, res: Response, next: NextFunction) {
  try {
    const notifications = await prisma.notification.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
    res.json({ notifications });
  } catch (err) { next(err); }
}

export async function createNotification(req: Request, res: Response, next: NextFunction) {
  try {
    const { date, title, type, body, published, sortOrder } = req.body;
    if (!date || !title) {
      res.status(400).json({ error: 'date and title are required' });
      return;
    }
    const notification = await prisma.notification.create({
      data: { date, title, type: type ?? 'Update', body: body ?? null, published: published ?? true, sortOrder: sortOrder ?? 0 },
    });
    res.status(201).json({ notification });
  } catch (err) { next(err); }
}

export async function updateNotification(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    const { date, title, type, body, published, sortOrder } = req.body;
    const notification = await prisma.notification.update({
      where: { id },
      data: { date, title, type, body, published, sortOrder },
    });
    res.json({ notification });
  } catch (err) { next(err); }
}

export async function deleteNotification(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params.id as string;
    await prisma.notification.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) { next(err); }
}
