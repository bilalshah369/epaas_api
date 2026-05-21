import { Router } from 'express';
import { verifyToken } from '../middleware/auth.middleware';
import { checkRole }   from '../middleware/role.middleware';
import { listPending, listAll, forwardToEC, eligibleEC, requestClarification, recordDecision, rejectApplication, listAppealReview, listExtensionRequests, grantExtensionRequest, rejectExtensionRequest, listAppealsReport, listReviewsReport } from '../controllers/technical.controller';

const router     = Router();
const techOfficer = [verifyToken, checkRole('TechnicalOfficer')];

router.get ('/all',                              ...techOfficer, listAll);
router.get ('/applications',                    ...techOfficer, listPending);
router.get ('/appeal-review',                   ...techOfficer, listAppealReview);
router.get ('/extension-requests',              ...techOfficer, listExtensionRequests);
router.post('/extension-requests/:id/grant',    ...techOfficer, grantExtensionRequest);
router.post('/extension-requests/:id/reject',   ...techOfficer, rejectExtensionRequest);
router.get ('/reports/appeals',                 ...techOfficer, listAppealsReport);
router.get ('/reports/reviews',                 ...techOfficer, listReviewsReport);
router.get ('/applications/:id/eligible-ec',            ...techOfficer, eligibleEC);
router.post('/applications/:id/forward-ec',             ...techOfficer, forwardToEC);
router.post('/applications/:id/request-clarification',  ...techOfficer, requestClarification);
router.post('/applications/:id/record-decision',        ...techOfficer, recordDecision);
router.post('/applications/:id/reject',                 ...techOfficer, rejectApplication);
// Send query: reuses existing POST /api/applications/:id/queries (verifyToken only)

export default router;
