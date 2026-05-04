import { prisma } from '../config/db';
import { AppError } from '../middleware/errorHandler.middleware';

export async function listExtensions(applicantId: string) {
  return prisma.extensionRequest.findMany({
    where:   { applicantId },
    include: { application: { select: { referenceNumber: true, applicationType: true, foodCategory: true, productName: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createExtension(
  applicantId:  string,
  applicationId: string,
  reason:        string,
  extensionDays: number,
  contactEmail:  string,
  justification: string,
) {
  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app)                          throw new AppError('Application not found', 404);
  if (app.applicantId !== applicantId) throw new AppError('Forbidden', 403);

  return prisma.extensionRequest.create({
    data: { applicationId, applicantId, reason, extensionDays, contactEmail, justification, status: 'Pending' },
    include: { application: { select: { referenceNumber: true, applicationType: true, foodCategory: true, productName: true } } },
  });
}

export async function updateExtension(
  id:            string,
  applicantId:   string,
  reason:        string,
  extensionDays: number,
  contactEmail:  string,
  justification: string,
) {
  const ext = await prisma.extensionRequest.findUnique({ where: { id } });
  if (!ext)                          throw new AppError('Extension request not found', 404);
  if (ext.applicantId !== applicantId) throw new AppError('Forbidden', 403);
  if (ext.status !== 'Pending')      throw new AppError('Only pending requests can be edited', 400);

  return prisma.extensionRequest.update({
    where: { id },
    data:  { reason, extensionDays, contactEmail, justification },
    include: { application: { select: { referenceNumber: true, applicationType: true, foodCategory: true, productName: true } } },
  });
}
