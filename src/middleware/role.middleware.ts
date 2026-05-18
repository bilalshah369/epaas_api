import { Request, Response, NextFunction } from 'express';
import { RoleCode } from '../config/constants';

// Usage: router.post('/assign', verifyToken, checkRole('NodalOfficerA'), handler)
export function checkRole(...allowedRoles: RoleCode[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!allowedRoles.includes(req.user.roleCode as RoleCode)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}
