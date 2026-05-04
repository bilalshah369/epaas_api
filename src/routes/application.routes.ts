import { Router } from 'express';
import { verifyToken } from '../middleware/auth.middleware';
import { checkRole }   from '../middleware/role.middleware';
import { myApplications, getOne, create, save, submit } from '../controllers/application.controller';
import queryRouter from './query.routes';

const router  = Router();
const applicant = [verifyToken, checkRole('Applicant')];

router.get('/my',           ...applicant, myApplications);
router.post('/',            ...applicant, create);
router.get('/:id',          verifyToken,  getOne);   // officers can read too
router.put('/:id',          ...applicant, save);
router.post('/:id/submit',  ...applicant, submit);

// Nested query routes — /api/applications/:id/queries/...
router.use('/:id/queries', queryRouter);

export default router;
