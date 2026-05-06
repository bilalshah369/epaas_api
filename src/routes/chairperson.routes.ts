import { Router } from 'express';
import { verifyToken } from '../middleware/auth.middleware';
import { checkRole } from '../middleware/role.middleware';
import {
  listPending, listAll, listReviews, listExtensions,
  approveApplication, rejectApplication, disposeReview,
} from '../controllers/chairperson.controller';

const router = Router();
const chairpersonMember = [verifyToken, checkRole('Chairperson')];

router.get ('/applications',              ...chairpersonMember, listPending);
router.get ('/all',                       ...chairpersonMember, listAll);
router.get ('/reviews',                   ...chairpersonMember, listReviews);
router.get ('/extension-requests',        ...chairpersonMember, listExtensions);
router.post('/applications/:id/approve',  ...chairpersonMember, approveApplication);
router.post('/applications/:id/reject',   ...chairpersonMember, rejectApplication);
router.post('/reviews/:id/dispose',       ...chairpersonMember, disposeReview);

export default router;
