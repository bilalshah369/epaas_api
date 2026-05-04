import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { loginApplicant, loginAuthority, register, me } from '../controllers/auth.controller';
import { verifyToken } from '../middleware/auth.middleware';

const router = Router();

// Stricter rate limit for login endpoints (TDD §10)
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts, please try again in a minute.' },
});

// POST /api/auth/login/applicant
router.post('/login/applicant', loginLimiter, loginApplicant);

// POST /api/auth/login/authority
router.post('/login/authority', loginLimiter, loginAuthority);

// POST /api/auth/register
router.post('/register', register);

// GET /api/auth/me  — verify token + return current user
router.get('/me', verifyToken, me);

export default router;
