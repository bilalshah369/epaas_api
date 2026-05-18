import { Router } from 'express';
import { verifyToken } from '../middleware/auth.middleware';
import { checkRole } from '../middleware/role.middleware';
import {
  listPending, listAll, listReviews, listExtensions,
  disposeReview, approveReview,
} from '../controllers/chairperson.controller';

const router = Router();
const chairpersonMember = [verifyToken, checkRole('Chairperson')];

router.get ('/applications',              ...chairpersonMember, listPending);
router.get ('/all',                       ...chairpersonMember, listAll);
router.get ('/reviews',                   ...chairpersonMember, listReviews);
router.get ('/extension-requests',        ...chairpersonMember, listExtensions);
router.post('/reviews/:id/dispose',  ...chairpersonMember, disposeReview);
router.post('/reviews/:id/approve',  ...chairpersonMember, approveReview);

export default router;
