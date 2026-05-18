/**
 * Wipes all transactional data, keeping roles and users intact.
 * Usage: npm run db:reset
 */

import 'dotenv/config';
import { prisma } from './config/db';

async function main() {
  console.log('🗑️  Resetting E-PAAS transactional data...\n');

  const [ext, rev, app, qry, doc, apps] = await prisma.$transaction([
    prisma.extensionRequest.deleteMany(),
    prisma.review.deleteMany(),
    prisma.appeal.deleteMany(),
    prisma.query.deleteMany(),
    prisma.document.deleteMany(),
    prisma.application.deleteMany(),
  ]);

  console.log(`  ✓ Extension requests deleted: ${ext.count}`);
  console.log(`  ✓ Reviews deleted:            ${rev.count}`);
  console.log(`  ✓ Appeals deleted:            ${app.count}`);
  console.log(`  ✓ Queries deleted:            ${qry.count}`);
  console.log(`  ✓ Documents deleted:          ${doc.count}`);
  console.log(`  ✓ Applications deleted:       ${apps.count}`);

  const roles = await prisma.role.count();
  const users = await prisma.user.count();
  console.log(`\n✅  Done. Kept ${roles} roles and ${users} users.\n`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
