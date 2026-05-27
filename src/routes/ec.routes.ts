import { Router } from 'express';
import { verifyToken } from '../middleware/auth.middleware';
import { checkRole } from '../middleware/role.middleware';
import {
  listPending, listAll, listAppealReview, listExtensionRequests,
  listAppealsReport, listReviewsReport,
  forwardToTechnicalOfficer, rejectApplication, requestClarification, saveAssessment,
  grantExtensionRequest, rejectExtensionRequest,
} from '../controllers/ec.controller';

const router = Router();
const ecMember = [verifyToken, checkRole('ExpertCommittee')];

router.get ('/all',                              ...ecMember, listAll);
router.get ('/applications',                    ...ecMember, listPending);
router.get ('/appeal-review',                   ...ecMember, listAppealReview);
router.get ('/extension-requests',              ...ecMember, listExtensionRequests);
router.post('/extension-requests/:id/grant',    ...ecMember, grantExtensionRequest);
router.post('/extension-requests/:id/reject',   ...ecMember, rejectExtensionRequest);
router.get ('/reports/appeals',                 ...ecMember, listAppealsReport);
router.get ('/reports/reviews',                 ...ecMember, listReviewsReport);
router.post ('/applications/:id/forward-technical', ...ecMember, forwardToTechnicalOfficer);
router.post ('/applications/:id/reject',         ...ecMember, rejectApplication);
router.post ('/applications/:id/clarify',        ...ecMember, requestClarification);
router.patch('/applications/:id/assessment',     ...ecMember, saveAssessment);

export default router;
