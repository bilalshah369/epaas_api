import { Router } from 'express';
import { verifyToken } from '../middleware/auth.middleware';
import { checkRole } from '../middleware/role.middleware';
import {
  listPending, listAll, listAppeals, listExtensions,
  forwardToChairperson, rejectApplication,
  approveAppeal, rejectAppeal,
} from '../controllers/ceo.controller';

const router = Router();
const ceoMember = [verifyToken, checkRole('CEO')];

router.get ('/applications',                          ...ceoMember, listPending);
router.get ('/all',                                   ...ceoMember, listAll);
router.get ('/appeals',                               ...ceoMember, listAppeals);
router.get ('/extension-requests',                    ...ceoMember, listExtensions);
router.post('/applications/:id/forward-chairperson',  ...ceoMember, forwardToChairperson);
router.post('/applications/:id/reject',               ...ceoMember, rejectApplication);
router.post('/appeals/:id/approve',                   ...ceoMember, approveAppeal);
router.post('/appeals/:id/reject',                    ...ceoMember, rejectAppeal);

export default router;
