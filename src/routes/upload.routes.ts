import { Router } from 'express';
import { verifyToken } from '../middleware/auth.middleware';
import { uploadFile, serveFile } from '../controllers/upload.controller';

const router = Router();

router.post('/',              verifyToken, uploadFile);
router.get('/:storedName',    serveFile);   // no auth — files served by UUID name (unguessable)

export default router;
