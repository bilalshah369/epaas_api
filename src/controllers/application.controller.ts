import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  getMyApplications,
  getApplication,
  createDraft,
  saveDraft,
  submitApplication,
  deleteDraft,
} from '../services/application.service';
import { AppError } from '../middleware/errorHandler.middleware';
import { prisma } from '../config/db';
const createSchema = z.object({
  applicationType: z.string().min(1),
  companyName:     z.string().min(1),
});

const saveSchema = z.object({
  formData:    z.record(z.unknown()),
  productName: z.string().optional(),
});

export async function myApplications(req: Request, res: Response, next: NextFunction) {
  try {
    const { applicationType, workflowType, stage } = req.query as Record<string, string | undefined>;
    res.json({ applications: await getMyApplications(req.user!.userId, { applicationType, workflowType, stage }) });
  } catch (err) { next(err); }
}

export async function getOne(req: Request, res: Response, next: NextFunction) {
  try {
    // Applicants can only see their own; officers can see any
    const applicantId = req.user!.roleCode === 'Applicant' ? req.user!.userId : undefined;
    res.json({ application: await getApplication(req.params.id as string, applicantId) });
  } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const body = createSchema.safeParse(req.body);
    if (!body.success) throw new AppError(body.error.errors[0].message, 422);
    const app = await createDraft(req.user!.userId, body.data.applicationType, body.data.companyName);
    res.status(201).json({ application: app });
  } catch (err) { next(err); }
}

export async function save(req: Request, res: Response, next: NextFunction) {
  try {
    const body = saveSchema.safeParse(req.body);
    if (!body.success) throw new AppError(body.error.errors[0].message, 422);
    const app = await saveDraft(req.params.id as string, req.user!.userId, body.data.formData, body.data.productName);
    res.json({ application: app });
  } catch (err) { next(err); }
}

export async function submit(req: Request, res: Response, next: NextFunction) {
  try {
    const app = await submitApplication(req.params.id as string, req.user!.userId);
    res.json({ application: app });
  } catch (err) { next(err); }
}

export async function deleteDraftApp(req: Request, res: Response, next: NextFunction) {
  try {
    await deleteDraft(req.params.id as string, req.user!.userId);
    res.json({ success: true });
  } catch (err) { next(err); }
}

// POST /api/applications/:id/send-certificate  →  email Form II certificate to applicant's registered email
export async function sendCertificateEmail(req: Request, res: Response, next: NextFunction) {
  try {
    const app = await prisma.application.findUnique({
      where: { id: req.params.id as string },
      include: { applicant: { select: { email: true, name: true } } },
    });
    if (!app) throw new AppError('Application not found', 404);
    if (app.applicantId !== req.user!.userId) throw new AppError('Forbidden', 403);
    if (app.stage !== 'Approved') throw new AppError('Certificate is only available for approved applications', 400);
    const toEmail = app.applicant.email;
    const name    = app.applicant.name ?? 'Applicant';
    // ── Send via nodemailer if SMTP is configured ──────────────────────────────
    const SMTP_HOST = process.env['SMTP_HOST'];
    if (SMTP_HOST) {
      // @ts-ignore - nodemailer is an optional runtime dependency
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.default.createTransport({
        host:   SMTP_HOST,
        port:   Number(process.env['SMTP_PORT'] ?? 587),
        secure: process.env['SMTP_SECURE'] === 'true',
        auth:   { user: process.env['SMTP_USER'], pass: process.env['SMTP_PASS'] },
      });
      await transporter.sendMail({
        from:    process.env['SMTP_FROM'] ?? 'noreply@epaas.gov.in',
        to:      toEmail,
        subject: `FSSAI E-PAAS — Approval Certificate for ${app.referenceNumber}`,
        html: `<p>Dear ${name},</p>
               <p>Congratulations! Your application <strong>${app.referenceNumber}</strong> has been <strong>approved</strong> by FSSAI.</p>
               <p>Please login to the E-PAAS portal and navigate to <em>My Applications → Decision History</em> to download your Form II certificate.</p>
               <p><strong>Application Ref:</strong> ${app.referenceNumber}<br>
               <strong>Company:</strong> ${app.companyName}<br>
               <strong>Product:</strong> ${app.productName ?? '—'}</p>
               <p>Regards,<br>FSSAI E-PAAS System</p>`,
      });
    } else {
      console.log(`[send-certificate] SMTP not configured — would email "${toEmail}" for app ${app.referenceNumber}`);
    }
    res.json({ success: true, sentTo: toEmail });
  } catch (err) { next(err); }
}

// POST /api/applications/:id/submit-pms-report  →  applicant uploads PMS monitoring report
export async function submitPmsReport(req: Request, res: Response, next: NextFunction) {
  try {
    const { storedName, originalName } = req.body as { storedName?: string; originalName?: string };
    if (!storedName?.trim()) throw new AppError('storedName is required', 400);
    const app = await prisma.application.findUnique({ where: { id: req.params.id as string } });
    if (!app) throw new AppError('Application not found', 404);
    if (app.applicantId !== req.user!.userId) throw new AppError('Forbidden', 403);
    if (app.stage !== 'Approved') throw new AppError('PMS report can only be submitted for approved applications', 400);
    const td = (app.toDecision as Record<string, unknown>) ?? {};
    if (!td.withPms) throw new AppError('This application does not have a PMS condition', 400);
    const doc = await prisma.document.create({
      data: { applicationId: app.id, fieldName: 'pmsReport', originalName: originalName ?? storedName, storedName, mimeType: 'application/octet-stream', size: 0, uploadedById: req.user!.userId },
    });
    res.status(201).json({ document: doc });
  } catch (err) { next(err); }
}

// POST /api/applications/:id/request-withdrawal  →  applicant requests withdrawal
export async function requestWithdrawal(req: Request, res: Response, next: NextFunction) {
  try {
    const { justification } = req.body as { justification?: string };
    if (!justification?.trim()) throw new AppError('Justification is required', 400);
    const app = await prisma.application.findUnique({ where: { id: req.params.id as string } });
    if (!app) throw new AppError('Application not found', 404);
    if (app.applicantId !== req.user!.userId) throw new AppError('Forbidden', 403);
    const INELIGIBLE = ['Draft', 'Rejected', 'Withdrawn', 'WithdrawnByAuthority'];
    if (INELIGIBLE.includes(app.stage)) throw new AppError(`Cannot withdraw application in stage: ${app.stage}`, 400);
    const existing = await prisma.withdrawalRequest.findFirst({ where: { applicationId: app.id, status: 'Pending' } });
    if (existing) throw new AppError('A withdrawal request is already pending for this application', 409);
    const request = await prisma.withdrawalRequest.create({
      data: { applicationId: app.id, requestedById: req.user!.userId, type: 'ByApplicant', justification: justification.trim(), status: 'Pending' },
    });
    res.status(201).json({ request });
  } catch (err) { next(err); }
}
