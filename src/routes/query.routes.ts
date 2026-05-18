import { Router } from 'express';
import { verifyToken } from '../middleware/auth.middleware';
import { checkRole }   from '../middleware/role.middleware';
import { listQueries, addQuery, respond, nodalForward, nodalForwardResponse } from '../controllers/query.controller';

const router = Router({ mergeParams: true }); // mergeParams exposes :id from parent router

router.get('/',                          verifyToken, listQueries);
router.post('/',                         verifyToken, addQuery);
router.post('/:qid/respond',             verifyToken, checkRole('Applicant'), respond);
router.post('/:qid/nodal-forward',       verifyToken, checkRole('NodalOfficerA'), nodalForward);
router.post('/:qid/nodal-forward-response', verifyToken, checkRole('NodalOfficerA'), nodalForwardResponse);

export default router;
