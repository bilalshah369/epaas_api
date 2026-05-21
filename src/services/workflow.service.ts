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

// Fetch applications in a given stage, optionally filtered by assigned officer.
// For Nodal: also include unassigned apps (assignedNodalId IS NULL) so apps where
// autoAssignNodal returned null are still visible to all Nodal Officers.
export async function getApplicationsByStage(stage: string, officerId?: string, field?: 'assignedNodalId' | 'assignedTOId' | 'assignedECId') {
  let where: any = { stage };
  if (officerId && field) {
    if (field === 'assignedNodalId') {
      where = { stage, OR: [{ assignedNodalId: officerId }, { assignedNodalId: null }] };
    } else {
      where[field] = officerId;
    }
  }
  return prisma.application.findMany({
    where,
    include: { applicant: { select: { username: true, email: true, licenseNumber: true } } },
    orderBy: { submittedAt: 'asc' },
  });
}

// Fetch all non-draft applications, optionally filtered by assigned officer.
// For Nodal: also include unassigned apps (assignedNodalId IS NULL).
export async function getAllApplications(officerId?: string, field?: 'assignedNodalId' | 'assignedTOId' | 'assignedECId') {
  let where: any = { stage: { not: 'Draft' } };
  if (officerId && field) {
    if (field === 'assignedNodalId') {
      where = { stage: { not: 'Draft' }, OR: [{ assignedNodalId: officerId }, { assignedNodalId: null }] };
    } else {
      where[field] = officerId;
    }
  }
  return prisma.application.findMany({
    where,
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

// Auto-assign the Nodal Officer with fewest active apps who handles this category.
// Falls back to any active Nodal Officer when no one has matching assignedCategories.
export async function autoAssignNodal(applicationType: string): Promise<string | null> {
  const eligible = await getEligibleOfficers(ROLES.NODAL_OFFICER_A, applicationType);
  if (eligible.length > 0) return eligible[0].id;
  // Fallback: pick any active Nodal Officer (handles case where no categories are configured)
  const any = await prisma.user.findFirst({
    where: { role: { roleCode: ROLES.NODAL_OFFICER_A }, isActive: true },
    orderBy: { id: 'asc' },
  });
  return any?.id ?? null;
}
