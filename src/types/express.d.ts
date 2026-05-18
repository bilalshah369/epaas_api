// Augments Express Request with the decoded JWT payload set by auth.middleware.
import { JwtPayload } from '../middleware/auth.middleware';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}
