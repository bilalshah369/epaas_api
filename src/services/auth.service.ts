import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/db';
import { ROLES } from '../config/constants';
import { AppError } from '../middleware/errorHandler.middleware';
import { JwtPayload } from '../middleware/auth.middleware';
import { User, Role } from '@prisma/client';

type UserWithRole = User & { role: Role };

// ── Helpers ────────────────────────────────────────────────────────────────

function signToken(user: UserWithRole): string {
  const payload: JwtPayload = {
    userId:   user.id,
    username: user.username,
    email:    user.email,
    roleCode: user.role.roleCode,
    roleName: user.role.roleName,
  };
  return jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
  } as jwt.SignOptions);
}

function toPublicUser(user: UserWithRole) {
  return {
    id:              user.id,
    username:        user.username,
    email:           user.email,
    roleCode:        user.role.roleCode,
    roleName:        user.role.roleName,
    licenseNumber:   user.licenseNumber  ?? undefined,
    officeLocation:  user.officeLocation ?? undefined,
    isActive:        user.isActive,
    name:            user.name            ?? undefined,
    mobile:          user.mobile          ?? undefined,
    orgName:         user.orgName         ?? undefined,
    natureOfBusiness:user.natureOfBusiness ?? undefined,
  };
}

// ── Applicant login (TDD §7.1 POST /auth/login/applicant) ────────────────

export async function loginApplicant(identifier: string, password: string) {
  // Applicants log in with their FSSAI license number OR email
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ licenseNumber: identifier }, { email: identifier }],
    },
    include: { role: true },
  });

  if (!user || !user.isActive) {
    throw new AppError('Invalid credentials', 401);
  }
  if (user.role.roleCode !== ROLES.APPLICANT) {
    throw new AppError('Use the Authority login for officer accounts', 400);
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new AppError('Invalid credentials', 401);

  return { user: toPublicUser(user), token: signToken(user) };
}

// ── Authority login (TDD §7.1 POST /auth/login/authority) ────────────────

export async function loginAuthority(username: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { username },
    include: { role: true },
  });

  if (!user || !user.isActive) {
    throw new AppError('Invalid credentials', 401);
  }
  if (user.role.roleCode === ROLES.APPLICANT) {
    throw new AppError('Use the Applicant login for applicant accounts', 400);
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new AppError('Invalid credentials', 401);

  return { user: toPublicUser(user), token: signToken(user) };
}

// ── Applicant registration (TDD §7.1 POST /auth/register) ────────────────

export interface RegisterData {
  name:              string;
  mobile:            string;
  email:             string;
  orgName:           string;
  natureOfBusiness:  string;
  password:          string;
}

export async function registerApplicant(data: RegisterData) {
  const applicantRole = await prisma.role.findUnique({
    where: { roleCode: ROLES.APPLICANT },
  });
  if (!applicantRole) throw new AppError('System configuration error', 500);

  // Uniqueness check
  const existing = await prisma.user.findFirst({
    where: { email: data.email },
  });
  if (existing) throw new AppError('Email is already registered', 409);

  const passwordHash = await bcrypt.hash(data.password, 12);

  // Auto-generate a unique username from the email prefix
  const emailPrefix = data.email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
  const count = await prisma.user.count();
  const username = `${emailPrefix}_${String(count + 1).padStart(4, '0')}`;

  const user = await prisma.user.create({
    data: {
      roleId:           applicantRole.id,
      username,
      email:            data.email,
      passwordHash,
      name:             data.name,
      mobile:           data.mobile,
      orgName:          data.orgName,
      natureOfBusiness: data.natureOfBusiness,
    },
    include: { role: true },
  });

  return { user: toPublicUser(user), token: signToken(user) };
}

// ── Get logged-in user by ID (used by auth middleware verify) ─────────────

export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: { role: true },
  });
  if (!user || !user.isActive) throw new AppError('User not found', 404);
  return toPublicUser(user);
}

// ── Update profile (orgName only) ─────────────────────────────────────────

export async function updateOrgName(id: string, orgName: string) {
  const user = await prisma.user.update({
    where: { id },
    data:  { orgName: orgName.trim() },
    include: { role: true },
  });
  return toPublicUser(user);
}
