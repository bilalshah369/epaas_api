import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { getAllApplications } from '../services/workflow.service';
import { prisma } from '../config/db';
import { AppError } from '../middleware/errorHandler.middleware';
import { ROLES } from '../config/constants';

const OFFICER_CREATION_ROLES = [ROLES.NODAL_OFFICER_A, ROLES.TECHNICAL_OFFICER, ROLES.EXPERT_COMMITTEE];
const VALID_CATEGORIES = ['NSF', 'ClaimApproval', 'AyurvedaAahara', 'RPET', 'AnyOther'];

const APP_INCLUDE = { applicant: { select: { username: true, email: true, licenseNumber: true } } };

// GET /api/admin/all  →  every non-draft application
export async function listAll(req: Request, res: Response, next: NextFunction) {
  try {
    const applications = await getAllApplications();
    res.json({ applications });
  } catch (e) { next(e); }
}

// GET /api/admin/officers  →  all non-Applicant users
export async function listOfficers(req: Request, res: Response, next: NextFunction) {
  try {
    const officers = await prisma.user.findMany({
      where: { role: { roleCode: { not: 'Applicant' } } },
      include: { role: { select: { roleCode: true, roleName: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ officers });
  } catch (e) { next(e); }
}

// GET /api/admin/roles  →  all available roles (for dropdown)
export async function listRoles(req: Request, res: Response, next: NextFunction) {
  try {
    const roles = await prisma.role.findMany({
      where: { roleCode: { not: 'Applicant' } },
      orderBy: { roleName: 'asc' },
    });
    res.json({ roles });
  } catch (e) { next(e); }
}

// GET /api/admin/officer-creation-roles  →  only Nodal/TO/EC (for Add Officer dropdown)
export async function listOfficerCreationRoles(req: Request, res: Response, next: NextFunction) {
  try {
    const roles = await prisma.role.findMany({
      where: { roleCode: { in: OFFICER_CREATION_ROLES } },
      orderBy: { roleName: 'asc' },
    });
    res.json({ roles });
  } catch (e) { next(e); }
}

// PATCH /api/admin/officers/:id/role  →  change officer role
export async function updateOfficerRole(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params['id'] as string;
    const { roleCode } = req.body as { roleCode?: string };
    if (!roleCode?.trim()) throw new AppError('roleCode is required', 400);
    const role = await prisma.role.findUnique({ where: { roleCode } });
    if (!role) throw new AppError('Invalid role code', 400);
    const user = await prisma.user.update({
      where: { id },
      data: { roleId: role.id },
      include: { role: { select: { roleCode: true, roleName: true } } },
    });
    res.json({ user });
  } catch (e) { next(e); }
}

// PATCH /api/admin/officers/:id/status  →  toggle isActive
export async function toggleOfficerStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params['id'] as string;
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw new AppError('User not found', 404);
    const user = await prisma.user.update({
      where: { id },
      data: { isActive: !existing.isActive },
      include: { role: { select: { roleCode: true, roleName: true } } },
    });
    res.json({ user });
  } catch (e) { next(e); }
}

// GET /api/admin/applications/:id/audit  →  synthetic timeline
export async function getAuditTrail(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params['id'] as string;

    const app = await prisma.application.findUnique({
      where: { id },
      include: {
        applicant: { select: { username: true, email: true } },
        queries: {
          orderBy: { createdAt: 'asc' },
          include: { askedBy: { select: { username: true } } },
        },
        appeals: { orderBy: { filedAt: 'asc' } },
        reviews: { orderBy: { filedAt: 'asc' } },
        extensionRequests: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!app) throw new AppError('Application not found', 404);

    type TimelineEvent = { dt: Date; stage: string; actor: string; role: string; notes: string };
    const events: TimelineEvent[] = [];

    // Application lifecycle
    events.push({
      dt: app.createdAt,
      stage: 'Application Created',
      actor: app.applicant.username,
      role: 'Applicant',
      notes: `Application created as Draft. Ref: ${app.referenceNumber}`,
    });
    if (app.submittedAt) {
      events.push({
        dt: app.submittedAt,
        stage: 'Application Submitted',
        actor: app.applicant.username,
        role: 'Applicant',
        notes: `Application submitted for processing. Type: ${app.applicationType}.`,
      });
    }

    // Queries
    for (const q of app.queries) {
      events.push({
        dt: q.createdAt,
        stage: 'Query Raised',
        actor: q.askedBy.username,
        role: q.originStage === 'WithTechnicalOfficer' ? 'TechnicalOfficer' : 'NodalOfficerA',
        notes: q.text.slice(0, 300),
      });
      if (q.respondedAt && q.response) {
        events.push({
          dt: q.respondedAt,
          stage: 'Query Response Submitted',
          actor: app.applicant.username,
          role: 'Applicant',
          notes: q.response.slice(0, 300),
        });
      }
    }

    // Extension requests
    for (const e of app.extensionRequests) {
      events.push({
        dt: e.createdAt,
        stage: 'Extension of Time Requested',
        actor: app.applicant.username,
        role: 'Applicant',
        notes: `${e.extensionDays} day(s) requested. Reason: ${e.reason.slice(0, 200)}`,
      });
    }

    // Appeals
    for (const a of app.appeals) {
      events.push({
        dt: a.filedAt,
        stage: 'Appeal Filed',
        actor: app.applicant.username,
        role: 'Applicant',
        notes: a.grounds.slice(0, 300),
      });
      if (a.decisionAt) {
        events.push({
          dt: a.decisionAt,
          stage: `Appeal ${a.status === 'AppealApproved' ? 'Approved' : 'Rejected'}`,
          actor: 'CEO',
          role: 'CEO',
          notes: a.decisionRemarks?.slice(0, 300) ?? '',
        });
      }
    }

    // Reviews
    for (const r of app.reviews) {
      events.push({
        dt: r.filedAt,
        stage: 'Review Petition Filed',
        actor: app.applicant.username,
        role: 'Applicant',
        notes: r.grounds.slice(0, 300),
      });
      if (r.decisionAt) {
        events.push({
          dt: r.decisionAt,
          stage: `Review ${r.status === 'ReviewDisposed' ? 'Disposed' : r.status}`,
          actor: 'Chairperson',
          role: 'Chairperson',
          notes: r.decisionRemarks?.slice(0, 300) ?? '',
        });
      }
    }

    // Current stage as terminal event
    events.push({
      dt: app.updatedAt,
      stage: `Stage Updated → ${app.stage}`,
      actor: 'System',
      role: 'System',
      notes: `Current application stage: ${app.stage}`,
    });

    events.sort((a, b) => new Date(a.dt).getTime() - new Date(b.dt).getTime());

    res.json({ application: app, timeline: events });
  } catch (e) { next(e); }
}

// POST /api/admin/officers  →  create new officer account
export async function createOfficer(req: Request, res: Response, next: NextFunction) {
  try {
    const { username, email, password, officeLocation, roleCode, assignedCategories } = req.body as {
      username?: string; email?: string; password?: string; officeLocation?: string;
      roleCode?: string; assignedCategories?: string[];
    };
    if (!username?.trim()) throw new AppError('Username is required', 400);
    if (!email?.trim())    throw new AppError('Email is required', 400);
    if (!password) throw new AppError('Password is required', 400);
    if (!roleCode?.trim()) throw new AppError('Role is required', 400);

    if (!OFFICER_CREATION_ROLES.includes(roleCode as any)) {
      throw new AppError('Only Nodal Officer, Technical Officer, or Expert Committee roles can be created here', 400);
    }

    const categories: string[] = Array.isArray(assignedCategories)
      ? assignedCategories.filter(c => VALID_CATEGORIES.includes(c))
      : [];
    if (categories.length === 0) throw new AppError('At least one application category must be assigned', 400);

    const role = await prisma.role.findUnique({ where: { roleCode } });
    if (!role) throw new AppError('Invalid role code', 400);

    const conflict = await prisma.user.findFirst({ where: { OR: [{ username }, { email }] } });
    if (conflict) throw new AppError('Username or email already in use', 409);

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        roleId: role.id,
        username: username.trim(),
        email: email.trim().toLowerCase(),
        passwordHash,
        officeLocation: officeLocation?.trim() || null,
        assignedCategories: categories,
        isActive: true,
      },
      include: { role: { select: { roleCode: true, roleName: true } } },
    });
    res.status(201).json({ user });
  } catch (e) { next(e); }
}

// PATCH /api/admin/officers/:id/profile  →  update officer profile info
export async function updateOfficerProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params['id'] as string;
    const { username, email, password, officeLocation, assignedCategories } = req.body as {
      username?: string; email?: string; password?: string;
      officeLocation?: string; assignedCategories?: string[];
    };
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw new AppError('User not found', 404);

    // Conflict check — skip self
    if (username?.trim() || email?.trim()) {
      const conflict = await prisma.user.findFirst({
        where: { OR: [...(username?.trim() ? [{ username: username.trim() }] : []), ...(email?.trim() ? [{ email: email.trim().toLowerCase() }] : [])], NOT: { id } },
      });
      if (conflict) throw new AppError('Username or email already in use', 409);
    }

    const data: Record<string, unknown> = {};
    if (username?.trim())      data.username       = username.trim();
    if (email?.trim())         data.email          = email.trim().toLowerCase();
    if (officeLocation !== undefined) data.officeLocation = officeLocation?.trim() || null;
    if (Array.isArray(assignedCategories)) {
      const cats = assignedCategories.filter(c => VALID_CATEGORIES.includes(c));
      if (cats.length === 0) throw new AppError('At least one application category must be assigned', 400);
      data.assignedCategories = cats;
    }
    if (password) {
      data.passwordHash = await bcrypt.hash(password, 12);
    }

    const user = await prisma.user.update({
      where: { id },
      data: data as any,
      include: { role: { select: { roleCode: true, roleName: true } } },
    });
    res.json({ user });
  } catch (e) { next(e); }
}

// DELETE /api/admin/officers/:id  →  permanently delete an officer account
export async function deleteOfficer(req: Request, res: Response, next: NextFunction) {
  try {
    const id = req.params['id'] as string;
    const user = await prisma.user.findUnique({ where: { id }, include: { role: true } });
    if (!user) throw new AppError('User not found', 404);
    if (user.role.roleCode === ROLES.ADMIN) throw new AppError('Cannot delete the system admin account', 403);
    if (user.role.roleCode === ROLES.APPLICANT) throw new AppError('Cannot delete applicant accounts from here', 403);
    await prisma.user.delete({ where: { id } });
    res.json({ success: true });
  } catch (e) { next(e); }
}

// POST /api/admin/roles  →  create new role
export async function createRole(req: Request, res: Response, next: NextFunction) {
  try {
    const { roleCode, roleName, description } = req.body as {
      roleCode?: string; roleName?: string; description?: string;
    };
    if (!roleCode?.trim()) throw new AppError('roleCode is required', 400);
    if (!roleName?.trim()) throw new AppError('roleName is required', 400);

    const existing = await prisma.role.findUnique({ where: { roleCode: roleCode.trim() } });
    if (existing) throw new AppError('Role code already exists', 409);

    const role = await prisma.role.create({
      data: {
        roleCode: roleCode.trim(),
        roleName: roleName.trim(),
        description: description?.trim() || null,
      },
    });
    res.status(201).json({ role });
  } catch (e) { next(e); }
}

// GET /api/admin/extensions  →  all extension requests
export async function listExtensions(req: Request, res: Response, next: NextFunction) {
  try {
    const requests = await prisma.extensionRequest.findMany({
      include: { application: { include: APP_INCLUDE } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ requests });
  } catch (e) { next(e); }
}

// GET /api/admin/appeals  →  all appeals
export async function listAppeals(req: Request, res: Response, next: NextFunction) {
  try {
    const appeals = await prisma.appeal.findMany({
      include: {
        application: { include: APP_INCLUDE },
        applicant: { select: { username: true, email: true } },
      },
      orderBy: { filedAt: 'desc' },
    });
    res.json({ appeals });
  } catch (e) { next(e); }
}
