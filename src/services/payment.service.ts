import Razorpay from 'razorpay';
import crypto from 'crypto';
import { prisma } from '../config/db';
import { AppError } from '../middleware/errorHandler.middleware';

// ── Fee table (paise) ─────────────────────────────────────────────────────────
const FEE_PAISE: Record<string, number> = {
  NSF:            5900000,  // ₹59,000
  ClaimApproval:  5900000,
  AyurvedaAahara: 5900000,
  RPET:           1770000,  // ₹17,700
  AnyOther:       1180000,  // ₹11,800
};

// Application types that are exempt from payment (no fee)
const NO_FEE_TYPES: string[] = [];

function getRazorpay() {
  return new Razorpay({
    key_id:     process.env.RAZORPAY_KEY_ID!,
    key_secret: process.env.RAZORPAY_KEY_SECRET!,
  });
}

// ── Invoice number generation ─────────────────────────────────────────────────
// Format: {YYMM_FY}ES{00000001}  e.g. 2526ES00000001
async function generateInvoiceNo(): Promise<string> {
  const now    = new Date();
  const month  = now.getMonth() + 1; // 1-based
  const year2  = now.getFullYear() % 100;
  // Financial year: April (4) starts new FY
  const fyStart = month >= 4 ? year2 : year2 - 1;
  const fyEnd   = fyStart + 1;
  const fyCode  = `${fyStart}${fyEnd}`;

  // Count completed payments in this financial year
  const fyStartDate = new Date(`20${fyStart}-04-01`);
  const fyEndDate   = new Date(`20${fyEnd}-03-31T23:59:59`);

  const count = await prisma.payment.count({
    where: {
      invoiceNo: { not: null },
      createdAt: { gte: fyStartDate, lte: fyEndDate },
    },
  });

  const seq = String(count + 1).padStart(8, '0');
  return `${fyCode}ES${seq}`;
}

// ── createOrder ───────────────────────────────────────────────────────────────
export async function createOrder(applicationId: string, userId: string) {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
  });
  if (!application) throw new AppError('Application not found', 404);
  if (application.applicantId !== userId) throw new AppError('Forbidden', 403);

  const amountPaise = FEE_PAISE[application.applicationType] ?? FEE_PAISE['NSF'];
  const isNoFee     = NO_FEE_TYPES.includes(application.applicationType);

  // Existing completed payment — idempotent
  const existing = await prisma.payment.findUnique({ where: { applicationId } });
  if (existing?.status === 'Completed') {
    return {
      alreadyPaid: true,
      invoiceNo:   existing.invoiceNo,
      keyId:       process.env.RAZORPAY_KEY_ID,
    };
  }
  // Existing pending order — return same order id
  if (existing?.razorpayOrderId) {
    return {
      orderId:  existing.razorpayOrderId,
      amount:   existing.amount,
      currency: existing.currency,
      keyId:    process.env.RAZORPAY_KEY_ID,
      isNoFee,
    };
  }

  const rzp   = getRazorpay();
  const order = await (rzp.orders.create as Function)({
    amount:   amountPaise,
    currency: 'INR',
    notes:    {
      applicationId,
      applicationType: application.applicationType,
      referenceNumber: application.referenceNumber,
    },
  });

  if (existing) {
    await prisma.payment.update({
      where: { applicationId },
      data:  { razorpayOrderId: order.id, amount: amountPaise, status: 'Pending' },
    });
  } else {
    await prisma.payment.create({
      data: {
        applicationId,
        userId,
        razorpayOrderId: order.id,
        amount:   amountPaise,
        currency: 'INR',
        status:   'Pending',
      },
    });
  }

  return {
    orderId:  order.id,
    amount:   amountPaise,
    currency: 'INR',
    keyId:    process.env.RAZORPAY_KEY_ID,
    isNoFee,
  };
}

// ── verifyPayment ─────────────────────────────────────────────────────────────
export async function verifyPayment(
  razorpayOrderId:   string,
  razorpayPaymentId: string,
  razorpaySignature: string,
) {
  // Cryptographic signature verification
  const secret    = process.env.RAZORPAY_KEY_SECRET!;
  const body      = `${razorpayOrderId}|${razorpayPaymentId}`;
  const expected  = crypto.createHmac('sha256', secret).update(body).digest('hex');

  if (expected !== razorpaySignature) {
    throw new AppError('Payment signature verification failed', 400);
  }

  const payment = await prisma.payment.findFirst({ where: { razorpayOrderId } });
  if (!payment) throw new AppError('Payment record not found', 404);

  const invoiceNo = await generateInvoiceNo();

  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      razorpayPaymentId,
      razorpaySignature,
      status:    'Completed',
      invoiceNo,
    },
  });

  return { invoiceNo: updated.invoiceNo };
}

// ── getPayment ────────────────────────────────────────────────────────────────
export async function getPayment(applicationId: string) {
  return prisma.payment.findUnique({ where: { applicationId } });
}

// ── isPaymentComplete ─────────────────────────────────────────────────────────
export async function isPaymentComplete(applicationId: string, applicationType: string): Promise<boolean> {
  if (NO_FEE_TYPES.includes(applicationType)) return true;
  const payment = await prisma.payment.findUnique({ where: { applicationId } });
  return payment?.status === 'Completed';
}
