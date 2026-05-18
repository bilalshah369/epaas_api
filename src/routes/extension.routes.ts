import { Router } from 'express';
import { verifyToken } from '../middleware/auth.middleware';
import { checkRole }   from '../middleware/role.middleware';
import { getExtensions, createExt, updateExt } from '../controllers/extension.controller';

const router    = Router();
const applicant = [verifyToken, checkRole('Applicant')];

router.get ('/',    ...applicant, getExtensions);
router.post('/',    ...applicant, createExt);
router.put ('/:id', ...applicant, updateExt);

export default router;
