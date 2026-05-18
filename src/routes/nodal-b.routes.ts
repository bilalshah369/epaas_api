import { Router } from 'express';
import { verifyToken } from '../middleware/auth.middleware';
import { checkRole } from '../middleware/role.middleware';
import {
  listPending, listAll, listAppeals, listExtensions,
  uploadECDecision, rejectApplication,
} from '../controllers/nodal-b.controller';

const router = Router();
const nodalBMember = [verifyToken, checkRole('NodalPointB')];

router.get ('/applications',                     ...nodalBMember, listPending);
router.get ('/all',                              ...nodalBMember, listAll);
router.get ('/appeals',                          ...nodalBMember, listAppeals);
router.get ('/extension-requests',               ...nodalBMember, listExtensions);
router.post('/applications/:id/upload-ec-decision', ...nodalBMember, uploadECDecision);
router.post('/applications/:id/reject',          ...nodalBMember, rejectApplication);

export default router;
