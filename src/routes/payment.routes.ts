import { Router } from 'express';
import { verifyToken } from '../middleware/auth.middleware';
import { checkRole }   from '../middleware/role.middleware';
import { createOrderHandler, verifyPaymentHandler, getPaymentHandler } from '../controllers/payment.controller';

const router    = Router();
const applicant = [verifyToken, checkRole('Applicant')];

// POST /api/payments/:applicationId/create-order
router.post('/:applicationId/create-order', ...applicant, createOrderHandler);

// POST /api/payments/verify
router.post('/verify', verifyToken, verifyPaymentHandler);

// GET  /api/payments/:applicationId
router.get('/:applicationId', verifyToken, getPaymentHandler);

export default router;
