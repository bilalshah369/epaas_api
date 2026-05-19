import { prisma } from '../config/db';
import { AppError } from '../middleware/errorHandler.middleware';

// Prisma client predates the supporting_document column migration.
// Use $queryRawUnsafe to fetch it separately and merge onto existing records.
export async function mergeSupDoc<T extends { id: string }>(records: T[]): Promise<(T & { supportingDocument: string | null })[]> {
  if (!records.length) return records.map((r) => ({ ...r, supportingDocument: null }));
  const ids = records.map((r) => r.id);
  // Build parameterised placeholder list: $1, $2, ...
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; sd: string | null }>>(
    `SELECT id, supporting_document AS sd FROM extension_requests WHERE id IN (${placeholders})`,
    ...ids,
  );
  const map = Object.fromEntries(rows.map((r) => [r.id, r.sd]));
  return records.map((r) => ({ ...r, supportingDocument: map[r.id] ?? null }));
}

export async function listExtensions(applicantId: string) {
  const records = await prisma.extensionRequest.findMany({
    where:   { applicantId },
    include: { application: { select: { referenceNumber: true, applicationType: true, foodCategory: true, productName: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return mergeSupDoc(records);
}

export async function createExtension(
  applicantId:       string,
  applicationId:     string,
  reason:            string,
  extensionDays:     number,
  contactEmail:      string,
  justification:     string,
  queryId?:          string,
  supportingDocument?: string,
) {
  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app)                          throw new AppError('Application not found', 404);
  if (app.applicantId !== applicantId) throw new AppError('Forbidden', 403);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extModel = prisma.extensionRequest as any;

  // One extension per query — prevent duplicate filing
  if (queryId) {
    const existing = await extModel.findFirst({ where: { queryId } });
    if (existing) throw new AppError('An extension request has already been filed for this query', 400);
  }

  const ext = await extModel.create({
    data: { applicationId, applicantId, reason, extensionDays, contactEmail, justification, status: 'Pending', ...(queryId ? { queryId } : {}) },
    include: { application: { select: { referenceNumber: true, applicationType: true, foodCategory: true, productName: true } } },
  });

  // Save supportingDocument via raw SQL because the Prisma client predates this column
  if (supportingDocument) {
    await prisma.$executeRaw`UPDATE extension_requests SET supporting_document = ${supportingDocument} WHERE id = ${ext.id}`;
    return { ...ext, supportingDocument };
  }
  return { ...ext, supportingDocument: null };
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
