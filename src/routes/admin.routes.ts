import { Router } from 'express';
import { verifyToken } from '../middleware/auth.middleware';
import { checkRole } from '../middleware/role.middleware';
import {
  listAll, listOfficers, listRoles, updateOfficerRole,
  toggleOfficerStatus, getAuditTrail, listExtensions, listAppeals,
  createOfficer, createRole,
} from '../controllers/admin.controller';

const router = Router();
const adminGuard = [verifyToken, checkRole('Admin')];

router.get   ('/all',                          ...adminGuard, listAll);
router.get   ('/officers',                     ...adminGuard, listOfficers);
router.post  ('/officers',                     ...adminGuard, createOfficer);
router.get   ('/roles',                        ...adminGuard, listRoles);
router.post  ('/roles',                        ...adminGuard, createRole);
router.patch ('/officers/:id/role',            ...adminGuard, updateOfficerRole);
router.patch ('/officers/:id/status',          ...adminGuard, toggleOfficerStatus);
router.get   ('/applications/:id/audit',       ...adminGuard, getAuditTrail);
router.get   ('/extensions',                   ...adminGuard, listExtensions);
router.get   ('/appeals',                      ...adminGuard, listAppeals);

export default router;
