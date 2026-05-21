/**
 * One-time script: generate approvalNumber for all Approved/Rejected apps that don't have one.
 * Run from backend/: npx tsx src/scripts/backfill-approval-numbers.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const APPR_TYPE_CODES: Record<string, string> = {
  NSF: '01', ClaimApproval: '02', RPET: '03', AyurvedaAahara: '04', AnyOther: '05',
};

const FOOD_CAT_CODES: Record<string, string> = {
  'Dairy & Products':                 '01',
  'Cereals & Pulse Products':         '02',
  'Bakery Products':                  '03',
  'Beverages':                        '04',
  'Meat & Poultry':                   '05',
  'Fish & Marine Products':           '06',
  'Fruits & Vegetables':              '07',
  'Fats & Oils':                      '08',
  'Confectionery':                    '09',
  'Health & Nutritional Foods':       '10',
  'Herbal & Ayurvedic Products':      '11',
  'Novel Foods':                      '12',
  'Fortified Foods':                  '13',
  'Infant Foods':                     '14',
  'Food Additives & Processing Aids': '15',
  'Packaging Materials':              '16',
  'FCM-rPET Packaging':               '16',
  'A':  '17', 'B': '18', 'B1': '19', 'B2': '20',
};

async function main() {
  const apps = await prisma.application.findMany({
    where: {
      stage: { in: ['Approved', 'Rejected', 'Withdrawn', 'WithdrawnByAuthority', 'Closed'] },
      approvalNumber: null,
    },
    orderBy: { updatedAt: 'asc' },
  });

  console.log(`Found ${apps.length} application(s) needing an approval number.`);
  if (apps.length === 0) { console.log('Nothing to backfill.'); return; }

  let updated = 0;
  for (const app of apps) {
    const isApproved = ['Approved', 'Closed'].includes(app.stage);
    const yy         = String(new Date(app.updatedAt).getFullYear()).slice(-2);
    const statusCode = isApproved ? '01' : '02';
    const typeCode   = APPR_TYPE_CODES[app.applicationType] ?? '00';
    const catCode    = FOOD_CAT_CODES[app.foodCategory?.trim()] ?? '00';
    // Count already-assigned numbers at this point to get a unique sequence
    const count      = await prisma.application.count({ where: { approvalNumber: { not: null } } });
    const seq        = String(count + 1).padStart(6, '0');
    const approvalNumber = `${yy} ${statusCode} ${typeCode} ${catCode} ${seq}`;

    await prisma.application.update({ where: { id: app.id }, data: { approvalNumber } });
    console.log(`  ${app.referenceNumber}  →  ${approvalNumber}`);
    updated++;
  }

  console.log(`\nDone. ${updated} application(s) updated.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
