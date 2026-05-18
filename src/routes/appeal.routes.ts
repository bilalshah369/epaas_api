import { Router } from 'express';
import { verifyToken } from '../middleware/auth.middleware';
import { checkRole }   from '../middleware/role.middleware';
import { getAppeals, createAppeal, getReviews, createReview } from '../controllers/appeal.controller';

const router     = Router();
const applicant  = [verifyToken, checkRole('Applicant')];

router.get ('/',        ...applicant, getAppeals);
router.post('/',        ...applicant, createAppeal);

router.get ('/reviews', ...applicant, getReviews);
router.post('/reviews', ...applicant, createReview);

export default router;
