import { Router } from 'express';
import { verifyToken } from '../middleware/auth.middleware';
import { checkRole }   from '../middleware/role.middleware';
import {
  listPending, listAll, listPmsApplications, forwardToTechnical, eligibleTO, listAppealsReport, listReviewsReport, listAppealReview, listExtensionRequests,
  grantExtensionRequest, rejectExtensionRequest, createExtensionRequest,
  sendDecisionToApplicant, forwardAppealToCEO, dispatchAppealDecision, dispatchReviewDecision, forwardReviewToChairperson,
  uploadAppealAuthorityDoc, uploadReviewAuthorityDoc,
  listWithdrawalRequests, approveWithdrawalRequest, rejectWithdrawalRequest, withdrawByAuthority,
} from '../controllers/nodalA.controller';

const router  = Router();
const nodalA  = [verifyToken, checkRole('NodalOfficerA')];

router.get('/all',                       ...nodalA, listAll);
router.get('/pms-applications',          ...nodalA, listPmsApplications);
router.get('/applications',              ...nodalA, listPending);
router.get('/reports/appeals',           ...nodalA, listAppealsReport);
router.get('/reports/reviews',           ...nodalA, listReviewsReport);
router.get('/appeal-review',             ...nodalA, listAppealReview);
router.get ('/extension-requests',                          ...nodalA, listExtensionRequests);
router.post('/extension-requests',                          ...nodalA, createExtensionRequest);
router.post('/extension-requests/:id/grant',                ...nodalA, grantExtensionRequest);
router.post('/extension-requests/:id/reject',               ...nodalA, rejectExtensionRequest);
router.get ('/applications/:id/eligible-to',   ...nodalA, eligibleTO);
router.post('/applications/:id/forward',       ...nodalA, forwardToTechnical);
router.post('/applications/:id/send-decision', ...nodalA, sendDecisionToApplicant);
router.post ('/appeals/:id/forward-to-ceo',     ...nodalA, forwardAppealToCEO);
router.post ('/appeals/:id/dispatch',           ...nodalA, dispatchAppealDecision);
router.post ('/reviews/:id/forward-to-chairperson', ...nodalA, forwardReviewToChairperson);
router.post ('/reviews/:id/dispatch',               ...nodalA, dispatchReviewDecision);
router.patch('/appeals/:id/upload-authority-doc',  ...nodalA, uploadAppealAuthorityDoc);
router.patch('/reviews/:id/upload-authority-doc',  ...nodalA, uploadReviewAuthorityDoc);
router.get   ('/withdrawal-requests',                          ...nodalA, listWithdrawalRequests);
router.post  ('/withdrawal-requests/:id/approve',              ...nodalA, approveWithdrawalRequest);
router.post  ('/withdrawal-requests/:id/reject',               ...nodalA, rejectWithdrawalRequest);
router.post  ('/applications/:id/withdraw-by-authority',       ...nodalA, withdrawByAuthority);
// Return with query: uses existing POST /api/applications/:id/queries (verifyToken only)

export default router;
