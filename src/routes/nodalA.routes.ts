import { Router } from 'express';
import { verifyToken } from '../middleware/auth.middleware';
import { checkRole }   from '../middleware/role.middleware';
import {
  listPending, listAll, forwardToTechnical, listAppealsReport, listReviewsReport, listAppealReview, listExtensionRequests,
  sendDecisionToApplicant, dispatchAppealDecision, dispatchReviewDecision,
} from '../controllers/nodalA.controller';

const router  = Router();
const nodalA  = [verifyToken, checkRole('NodalOfficerA')];

router.get('/all',                       ...nodalA, listAll);
router.get('/applications',              ...nodalA, listPending);
router.get('/reports/appeals',           ...nodalA, listAppealsReport);
router.get('/reports/reviews',           ...nodalA, listReviewsReport);
router.get('/appeal-review',             ...nodalA, listAppealReview);
router.get('/extension-requests',        ...nodalA, listExtensionRequests);
router.post('/applications/:id/forward',       ...nodalA, forwardToTechnical);
router.post('/applications/:id/send-decision', ...nodalA, sendDecisionToApplicant);
router.post('/appeals/:id/dispatch',           ...nodalA, dispatchAppealDecision);
router.post('/reviews/:id/dispatch',           ...nodalA, dispatchReviewDecision);
// Return with query: uses existing POST /api/applications/:id/queries (verifyToken only)

export default router;
