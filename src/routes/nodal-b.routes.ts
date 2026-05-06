import { Router } from 'express';
import { verifyToken } from '../middleware/auth.middleware';
import { checkRole } from '../middleware/role.middleware';
import {
  listPending, listAll, listAppeals, listExtensions,
  forwardToCEO, rejectApplication,
} from '../controllers/nodal-b.controller';

const router = Router();
const nodalBMember = [verifyToken, checkRole('NodalPointB')];

router.get ('/applications',                     ...nodalBMember, listPending);
router.get ('/all',                              ...nodalBMember, listAll);
router.get ('/appeals',                          ...nodalBMember, listAppeals);
router.get ('/extension-requests',               ...nodalBMember, listExtensions);
router.post('/applications/:id/forward-ceo',     ...nodalBMember, forwardToCEO);
router.post('/applications/:id/reject',          ...nodalBMember, rejectApplication);

export default router;
