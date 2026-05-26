import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { createOrder, verifyPayment, getPayment } from '../services/payment.service';
import { AppError } from '../middleware/errorHandler.middleware';

const verifySchema = z.object({
  razorpayOrderId:   z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().min(1),
});

export async function createOrderHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const applicationId = req.params.applicationId as string;
    const result = await createOrder(applicationId, req.user!.userId);
    res.json(result);
  } catch (err) { next(err); }
}

export async function verifyPaymentHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const body = verifySchema.safeParse(req.body);
    if (!body.success) throw new AppError(body.error.errors[0].message, 422);
    const result = await verifyPayment(
      body.data.razorpayOrderId,
      body.data.razorpayPaymentId,
      body.data.razorpaySignature,
    );
    res.json(result);
  } catch (err) { next(err); }
}

export async function getPaymentHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const payment = await getPayment(req.params.applicationId as string);
    res.json({ payment: payment ?? null });
  } catch (err) { next(err); }
}
