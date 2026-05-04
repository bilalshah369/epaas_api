/**
 * Seed file — run once after `prisma migrate dev`.
 * Creates all 8 roles and one test user per role.
 *
 * Usage:  npm run db:seed
 * Credentials (all non-admin): password = Test@1234
 * Admin password: Admin@1234
 */

import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from './config/db';
import { ROLES } from './config/constants';

const ROLES_SEED = [
  { roleCode: ROLES.APPLICANT,         roleName: 'Applicant',          description: 'Submits applications, responds to queries, files appeals and reviews' },
  { roleCode: ROLES.NODAL_OFFICER_A,   roleName: 'Nodal Officer A',    description: 'Receives applications, assigns Technical Officers, dispatches decisions' },
  { roleCode: ROLES.TECHNICAL_OFFICER, roleName: 'Technical Officer',  description: 'Reviews documents, performs scrutiny, drafts queries, prepares decision letters' },
  { roleCode: ROLES.EXPERT_COMMITTEE,  roleName: 'Expert Committee',   description: 'Evaluates referred applications, records Approved/Rejected/Clarification decision' },
  { roleCode: ROLES.NODAL_POINT_B,     roleName: 'Nodal Point B',      description: 'Uploads final EC-approved decision into E-PAAS' },
  { roleCode: ROLES.CEO,               roleName: 'CEO',                description: 'Appellate authority when applicant files an appeal after rejection' },
  { roleCode: ROLES.CHAIRPERSON,       roleName: 'Chairperson',        description: 'Final review authority — decision is absolute and cannot be appealed' },
  { roleCode: ROLES.ADMIN,             roleName: 'Admin',              description: 'Read-only monitoring of all applications, manages officer accounts' },
];

async function main() {
  console.log('🌱  Seeding E-PAAS database...\n');

  // ── Roles ─────────────────────────────────────────────────────────────
  const roleMap: Record<string, string> = {};

  for (const r of ROLES_SEED) {
    const role = await prisma.role.upsert({
      where:  { roleCode: r.roleCode },
      update: { roleName: r.roleName, description: r.description },
      create: r,
    });
    roleMap[r.roleCode] = role.id;
    console.log(`  ✓ Role: ${r.roleName}`);
  }

  const hash      = await bcrypt.hash('Test@1234',  12);
  const adminHash = await bcrypt.hash('Admin@1234', 12);

  // ── Test users (one per role) ──────────────────────────────────────────
  const users = [
    {
      roleCode:      ROLES.APPLICANT,
      username:      'FBO-MH-2024-08812',
      email:         'applicant@epaas.test',
      passwordHash:  hash,
      licenseNumber: 'FBO-MH-2024-08812',
    },
    {
      roleCode:       ROLES.NODAL_OFFICER_A,
      username:       'nodal.sharma',
      email:          'nodal@epaas.test',
      passwordHash:   hash,
      officeLocation: 'Delhi HQ',
    },
    {
      roleCode:       ROLES.TECHNICAL_OFFICER,
      username:       'tech.verma',
      email:          'tech@epaas.test',
      passwordHash:   hash,
      officeLocation: 'Delhi HQ',
    },
    {
      roleCode:       ROLES.EXPERT_COMMITTEE,
      username:       'ec.iyer',
      email:          'ec@epaas.test',
      passwordHash:   hash,
      officeLocation: 'Mumbai',
    },
    {
      roleCode:       ROLES.NODAL_POINT_B,
      username:       'nodalb.pillai',
      email:          'nodalb@epaas.test',
      passwordHash:   hash,
      officeLocation: 'Delhi HQ',
    },
    {
      roleCode:       ROLES.CEO,
      username:       'ceo.mehta',
      email:          'ceo@epaas.test',
      passwordHash:   hash,
      officeLocation: 'FSSAI HQ',
    },
    {
      roleCode:       ROLES.CHAIRPERSON,
      username:       'cp.nair',
      email:          'cp@epaas.test',
      passwordHash:   hash,
      officeLocation: 'FSSAI HQ',
    },
    {
      roleCode:       ROLES.ADMIN,
      username:       'admin',
      email:          'admin@epaas.test',
      passwordHash:   adminHash,
      officeLocation: 'FSSAI HQ',
    },
  ];

  for (const u of users) {
    const { roleCode, ...data } = u;
    await prisma.user.upsert({
      where:  { username: data.username },
      update: {},
      create: { ...data, roleId: roleMap[roleCode] },
    });
    console.log(`  ✓ User: ${data.username}  (${roleCode})`);
  }

  // ── Test applications for the applicant user ──────────────────────────────
  const applicantUser = await prisma.user.findUnique({ where: { username: 'FBO-MH-2024-08812' } });
  if (applicantUser) {
    const testApplications = [
      {
        referenceNumber: 'DRAFT-2026-001',
        applicantId:     applicantUser.id,
        companyName:     'ABC Foods Ltd',
        address:         '12, Industrial Area, Delhi',
        applicationType: 'NSF',
        foodCategory:    'Dairy & Products',
        stage:           'Draft',
      },
      {
        referenceNumber: 'DRAFT-2026-002',
        applicantId:     applicantUser.id,
        companyName:     'GreenLeaf Pvt Ltd',
        address:         '45 Sector 5, Mumbai',
        applicationType: 'ClaimApproval',
        foodCategory:    'Beverages',
        stage:           'Draft',
      },
      {
        referenceNumber: 'APP-2026-NSF-00501',
        applicantId:     applicantUser.id,
        companyName:     'PureNutrients India Pvt Ltd',
        address:         '7, DLF Cyber City, Gurugram',
        applicationType: 'NSF',
        foodCategory:    'Health & Nutritional Foods',
        stage:           'WithNodalOfficerA',
        submittedAt:     new Date('2026-05-01'),
      },
      {
        referenceNumber: 'APP-2026-NSF-00423',
        applicantId:     applicantUser.id,
        companyName:     'ABC Foods Ltd',
        address:         '12, Industrial Area, Delhi',
        applicationType: 'NSF',
        foodCategory:    'Dairy & Products',
        stage:           'WithTechnicalOfficer',
        submittedAt:     new Date('2026-04-10'),
      },
      {
        referenceNumber: 'APP-2026-CA-00318',
        applicantId:     applicantUser.id,
        companyName:     'XYZ Nutrition Pvt Ltd',
        address:         '78, BKC, Mumbai',
        applicationType: 'ClaimApproval',
        foodCategory:    'Health Foods',
        stage:           'WithExpertCommittee',
        submittedAt:     new Date('2026-04-09'),
      },
      {
        referenceNumber: 'APP-2026-AA-00112',
        applicantId:     applicantUser.id,
        companyName:     'GreenLeaf Ingredients',
        address:         '22, Koramangala, Bengaluru',
        applicationType: 'AyurvedaAahara',
        foodCategory:    'Herbal Products',
        stage:           'QuerySent',
        submittedAt:     new Date('2026-04-08'),
      },
      {
        referenceNumber: 'APP-2026-RPET-00076',
        applicantId:     applicantUser.id,
        companyName:     'SafePack Polymers',
        address:         '101 MIDC, Pune',
        applicationType: 'RPET',
        foodCategory:    'Packaging',
        stage:           'Rejected',
        submittedAt:     new Date('2026-03-20'),
      },
      {
        referenceNumber: 'APP-2026-NSF-00389',
        applicantId:     applicantUser.id,
        companyName:     'NutriLife Foods',
        address:         '33, Andheri East, Mumbai',
        applicationType: 'NSF',
        foodCategory:    'Fortified Foods',
        stage:           'Approved',
        submittedAt:     new Date('2026-03-15'),
      },
    ];

    for (const a of testApplications) {
      await prisma.application.upsert({
        where:  { referenceNumber: a.referenceNumber },
        update: {},
        create: a,
      });
      console.log(`  ✓ Application: ${a.referenceNumber}  (${a.stage})`);
    }

    // ── Test queries for the QuerySent application ──────────────────────────
    const techUser    = await prisma.user.findUnique({ where: { username: 'tech.verma' } });
    const querySentApp = await prisma.application.findUnique({ where: { referenceNumber: 'APP-2026-AA-00112' } });

    if (techUser && querySentApp) {
      const existingQueries = await prisma.query.count({ where: { applicationId: querySentApp.id } });
      if (existingQueries === 0) {
        await prisma.query.create({
          data: {
            applicationId:    querySentApp.id,
            text:             'Please provide additional documentation regarding the safety assessment of the proposed ingredients. Specifically, the toxicological study reports (acute, sub-acute, and chronic toxicity) are missing from the submitted application. Please upload these documents along with a summary of findings, including NOAEL values and acceptable daily intake calculations.',
            askedById:        techUser.id,
            revertedFromStage:'WithTechnicalOfficer',
          },
        });
        console.log('  ✓ Query: test query created for APP-2026-AA-00112');
      }
    }
  }

  console.log('\n✅  Seed complete.\n');
  console.log('Test credentials:');
  console.log('  Applicant  →  license: FBO-MH-2024-08812   pw: Test@1234');
  console.log('  Nodal A    →  username: nodal.sharma         pw: Test@1234');
  console.log('  Technical  →  username: tech.verma           pw: Test@1234');
  console.log('  EC         →  username: ec.iyer              pw: Test@1234');
  console.log('  Nodal B    →  username: nodalb.pillai        pw: Test@1234');
  console.log('  CEO        →  username: ceo.mehta            pw: Test@1234');
  console.log('  Chairperson→  username: cp.nair              pw: Test@1234');
  console.log('  Admin      →  username: admin                pw: Admin@1234');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
