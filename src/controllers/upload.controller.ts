import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { prisma } from '../config/db';
import { AppError } from '../middleware/errorHandler.middleware';
import { uploadMiddleware, UPLOAD_DIR } from '../middleware/upload.middleware';

// POST /api/uploads  — multipart: file + applicationId + fieldName
export function uploadFile(req: Request, res: Response, next: NextFunction) {
  uploadMiddleware(req, res, async (err) => {
    if (err) return next(new AppError(err.message, 400));
    try {
      const file          = req.file;
      const applicationId = req.body.applicationId as string | undefined;
      const fieldName     = req.body.fieldName     as string | undefined;

      if (!file) throw new AppError('No file received', 400);

      // Persist Document record when applicationId is provided
      let document = null;
      if (applicationId && fieldName) {
        // Verify application exists
        const app = await prisma.application.findUnique({ where: { id: applicationId } });
        if (!app) throw new AppError('Application not found', 404);

        // Upsert: replace previous file for same field
        const existing = await prisma.document.findFirst({
          where: { applicationId, fieldName },
        });
        if (existing) {
          // Remove old file from disk (best-effort)
          const oldPath = path.join(UPLOAD_DIR, existing.storedName);
          fs.unlink(oldPath, () => {});
          await prisma.document.delete({ where: { id: existing.id } });
        }

        document = await prisma.document.create({
          data: {
            applicationId,
            fieldName,
            originalName: file.originalname,
            storedName:   file.filename,
            mimeType:     file.mimetype,
            size:         file.size,
            uploadedById: req.user!.userId,
          },
        });
      }

      res.status(201).json({
        storedName:   file.filename,
        originalName: file.originalname,
        mimeType:     file.mimetype,
        size:         file.size,
        document,
      });
    } catch (e) {
      // Clean up uploaded file on error
      if (req.file) fs.unlink(req.file.path, () => {});
      next(e);
    }
  });
}

// GET /api/uploads/:storedName  — serve file (no auth for now; add in prod)
export function serveFile(req: Request, res: Response, next: NextFunction) {
  const storedName = req.params.storedName as string;
  // Basic path traversal guard
  if (storedName.includes('/') || storedName.includes('\\') || storedName.includes('..')) {
    return next(new AppError('Invalid file name', 400));
  }
  const filePath = path.join(UPLOAD_DIR, storedName);
  if (!fs.existsSync(filePath)) return next(new AppError('File not found', 404));
  // Use { root } form — avoids Windows absolute-path quirks in Express sendFile
  res.sendFile(storedName, { root: UPLOAD_DIR }, (err) => {
    if (err) next(new AppError('File not found', 404));
  });
}
