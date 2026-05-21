import { prisma } from '../config/db';
import { AppError } from '../middleware/errorHandler.middleware';
import { ROLES } from '../config/constants';

// Generic single-stage advance — caller must validate the role has permission.
export async function advanceStage(
  appId:                string,
  requiredCurrentStage: string,
  targetStage:          string,
) {
  const app = await prisma.application.findUnique({ where: { id: appId } });
  if (!app) throw new AppError('Application not found', 404);
  if (app.stage !== requiredCurrentStage) {
    throw new AppError(
      `Cannot advance: application is in "${app.stage}", expected "${requiredCurrentStage}"`,
      400,
    );
  }
  return prisma.application.update({
    where: { id: appId },
    data:  { stage: targetStage },
  });
}

// Fetch applications in a given stage, optionally filtered by assigned officer
export async function getApplicationsByStage(stage: string, officerId?: string, field?: 'assignedNodalId' | 'assignedTOId' | 'assignedECId') {
  const where: Record<string, unknown> = { stage };
  if (officerId && field) where[field] = officerId;
  return prisma.application.findMany({
    where:   where as any,
    include: { applicant: { select: { username: true, email: true, licenseNumber: true } } },
    orderBy: { submittedAt: 'asc' },
  });
}

// Fetch all non-draft applications, optionally filtered by assigned officer
export async function getAllApplications(officerId?: string, field?: 'assignedNodalId' | 'assignedTOId' | 'assignedECId') {
  const where: Record<string, unknown> = { stage: { not: 'Draft' } };
  if (officerId && field) where[field] = officerId;
  return prisma.application.findMany({
    where:   where as any,
    include: { applicant: { select: { username: true, email: true, licenseNumber: true } } },
    orderBy: { submittedAt: 'desc' },
  });
}

// Returns eligible officers for a role + category with workload counts
export async function getEligibleOfficers(roleCode: string, applicationType: string) {
  const officers = await prisma.user.findMany({
    where: {
      role: { roleCode },
      isActive: true,
      assignedCategories: { has: applicationType },
    },
    select: {
      id: true,
      username: true,
      email: true,
      officeLocation: true,
      assignedCategories: true,
    },
  });

  // Count active assignments per officer
  const assignmentField = roleCode === ROLES.NODAL_OFFICER_A
    ? 'assignedNodalId'
    : roleCode === ROLES.TECHNICAL_OFFICER
    ? 'assignedTOId'
    : 'assignedECId';

  const counts = await prisma.application.groupBy({
    by: [assignmentField as any],
    where: {
      [assignmentField]: { in: officers.map(o => o.id) },
      stage: { notIn: ['Draft', 'Approved', 'Rejected', 'Withdrawn', 'WithdrawnByAuthority'] },
    },
    _count: { id: true },
  });

  const countMap = Object.fromEntries(
    counts.map((c: any) => [c[assignmentField], c._count.id])
  );

  return officers.map(o => ({
    ...o,
    activeApplications: countMap[o.id] ?? 0,
  })).sort((a, b) => a.activeApplications - b.activeApplications);
}

// Auto-assign the Nodal Officer with fewest active apps who handles this category
export async function autoAssignNodal(applicationType: string): Promise<string | null> {
  const eligible = await getEligibleOfficers(ROLES.NODAL_OFFICER_A, applicationType);
  if (eligible.length === 0) return null;
  return eligible[0].id; // already sorted by workload ascending
}
