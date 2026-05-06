import { Router } from 'express';
import { verifyToken } from '../middleware/auth.middleware';
import { checkRole } from '../middleware/role.middleware';
import {
  listPending, listAll, listAppealReview, listExtensionRequests,
  listAppealsReport, listReviewsReport,
  forwardToNodalB, rejectApplication, requestClarification, saveAssessment,
} from '../controllers/ec.controller';

const router = Router();
const ecMember = [verifyToken, checkRole('ExpertCommittee')];

router.get ('/all',                              ...ecMember, listAll);
router.get ('/applications',                    ...ecMember, listPending);
router.get ('/appeal-review',                   ...ecMember, listAppealReview);
router.get ('/extension-requests',              ...ecMember, listExtensionRequests);
router.get ('/reports/appeals',                 ...ecMember, listAppealsReport);
router.get ('/reports/reviews',                 ...ecMember, listReviewsReport);
router.post ('/applications/:id/forward-nodalb', ...ecMember, forwardToNodalB);
router.post ('/applications/:id/reject',         ...ecMember, rejectApplication);
router.post ('/applications/:id/clarify',        ...ecMember, requestClarification);
router.patch('/applications/:id/assessment',     ...ecMember, saveAssessment);

export default router;
