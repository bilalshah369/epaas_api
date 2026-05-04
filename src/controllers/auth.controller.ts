import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as authService from '../services/auth.service';
import { AppError } from '../middleware/errorHandler.middleware';

// ── Validators ─────────────────────────────────────────────────────────────

const loginApplicantSchema = z.object({
  identifier: z.string().min(1, 'License number or email is required'),
  password:   z.string().min(1, 'Password is required'),
});

const loginAuthoritySchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

const registerSchema = z.object({
  name:             z.string().min(2, 'Full name is required'),
  mobile:           z.string().min(10, 'Valid mobile number required'),
  email:            z.string().email('Valid email is required'),
  orgName:          z.string().min(2, 'Organisation name is required'),
  natureOfBusiness: z.string().min(1, 'Nature of business is required'),
  password:         z.string().min(8, 'Password must be at least 8 characters'),
});

// ── Handlers ───────────────────────────────────────────────────────────────

export async function loginApplicant(req: Request, res: Response, next: NextFunction) {
  try {
    const { identifier, password } = loginApplicantSchema.parse(req.body);
    const result = await authService.loginApplicant(identifier, password);
    res.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new AppError(err.errors[0].message, 422));
    }
    next(err);
  }
}

export async function loginAuthority(req: Request, res: Response, next: NextFunction) {
  try {
    const { username, password } = loginAuthoritySchema.parse(req.body);
    const result = await authService.loginAuthority(username, password);
    res.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new AppError(err.errors[0].message, 422));
    }
    next(err);
  }
}

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const data = registerSchema.parse(req.body);
    const result = await authService.registerApplicant(data);
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new AppError(err.errors[0].message, 422));
    }
    next(err);
  }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) return next(new AppError('Unauthenticated', 401));
    const user = await authService.getUserById(req.user.userId);
    res.json({ user });
  } catch (err) {
    next(err);
  }
}
