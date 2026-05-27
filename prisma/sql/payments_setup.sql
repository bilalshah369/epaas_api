-- ============================================================
--  E-PAAS  |  Payments — Database Script
--  Run on: PostgreSQL (the migration already ran this via
--  prisma migrate dev; use this for reference / manual runs)
--  Date: 2026-05-27
-- ============================================================


-- ============================================================
--  SECTION 1 — CREATE TABLE  (payments)
-- ============================================================

CREATE TABLE IF NOT EXISTS "payments" (

    -- Primary key
    "id"                  TEXT          NOT NULL,

    -- One payment record per application (1-to-1)
    "application_id"      TEXT          NOT NULL,

    -- Owner of the application
    "user_id"             TEXT          NOT NULL,

    -- Razorpay order created on step: POST /api/payments/:id/create-order
    "razorpay_order_id"   TEXT,               -- e.g.  order_Pxxx...  (NULL until order created)

    -- Populated after successful payment + signature verification
    "razorpay_payment_id" TEXT,               -- e.g.  pay_Qxxx...   (NULL until verified)
    "razorpay_signature"  TEXT,               -- HMAC-SHA256 hex     (NULL until verified)

    -- Fee amount stored in PAISE (100 paise = ₹1)
    --   NSF / CA / AA  = 5900000  (₹59,000)
    --   RPET           = 1770000  (₹17,700)
    --   AnyOther       = 1180000  (₹11,800)
    "amount"              INTEGER       NOT NULL,

    "currency"            TEXT          NOT NULL  DEFAULT 'INR',

    -- Lifecycle: Pending → Completed  |  Pending → Failed
    "status"              TEXT          NOT NULL  DEFAULT 'Pending',

    -- Sequential invoice number generated on Completed
    -- Format: {FYSTART}{FYEND}ES{00000001}  e.g.  2526ES00000001
    "invoice_no"          TEXT,               -- NULL until payment verified

    "created_at"          TIMESTAMP(3)  NOT NULL  DEFAULT CURRENT_TIMESTAMP,
    "updated_at"          TIMESTAMP(3)  NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);


-- ============================================================
--  SECTION 2 — INDEXES
-- ============================================================

-- Unique: one payment row per application
CREATE UNIQUE INDEX IF NOT EXISTS "payments_application_id_key"
    ON "payments" ("application_id");

-- Lookup by user (for dashboard / invoice list)
CREATE INDEX IF NOT EXISTS "payments_user_id_idx"
    ON "payments" ("user_id");

-- Lookup by status (for reporting / pending sweeps)
CREATE INDEX IF NOT EXISTS "payments_status_idx"
    ON "payments" ("status");

-- Lookup by Razorpay order ID (used during verify step)
CREATE INDEX IF NOT EXISTS "payments_razorpay_order_id_idx"
    ON "payments" ("razorpay_order_id");


-- ============================================================
--  SECTION 3 — FOREIGN KEYS
-- ============================================================

-- Link to applications table
ALTER TABLE "payments"
    ADD CONSTRAINT "payments_application_id_fkey"
    FOREIGN KEY ("application_id")
    REFERENCES "applications" ("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

-- Link to users table
ALTER TABLE "payments"
    ADD CONSTRAINT "payments_user_id_fkey"
    FOREIGN KEY ("user_id")
    REFERENCES "users" ("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE;


-- ============================================================
--  SECTION 4 — STATUS CHECK CONSTRAINT  (optional safety net)
-- ============================================================

ALTER TABLE "payments"
    ADD CONSTRAINT "payments_status_check"
    CHECK ("status" IN ('Pending', 'Completed', 'Failed'));


-- ============================================================
--  SECTION 5 — USEFUL VIEWS
-- ============================================================

-- View: all completed payments with application + user info
CREATE OR REPLACE VIEW "v_completed_payments" AS
SELECT
    p."id"                    AS payment_id,
    p."invoice_no",
    p."amount"                AS amount_paise,
    (p."amount" / 100.0)      AS amount_rupees,
    p."currency",
    p."status",
    p."razorpay_order_id",
    p."razorpay_payment_id",
    p."created_at",
    p."updated_at",
    a."reference_number",
    a."application_type",
    a."company_name",
    a."stage"                 AS application_stage,
    u."email"                 AS applicant_email,
    u."mobile"                AS applicant_mobile
FROM  "payments"     p
JOIN  "applications" a ON a."id" = p."application_id"
JOIN  "users"        u ON u."id" = p."user_id"
WHERE p."status" = 'Completed'
ORDER BY p."created_at" DESC;


-- View: pending payments (started but not completed)
CREATE OR REPLACE VIEW "v_pending_payments" AS
SELECT
    p."id"                    AS payment_id,
    p."razorpay_order_id",
    p."amount"                AS amount_paise,
    (p."amount" / 100.0)      AS amount_rupees,
    p."created_at"            AS order_created_at,
    a."reference_number",
    a."application_type",
    u."email"                 AS applicant_email
FROM  "payments"     p
JOIN  "applications" a ON a."id" = p."application_id"
JOIN  "users"        u ON u."id" = p."user_id"
WHERE p."status" = 'Pending'
  AND p."razorpay_order_id" IS NOT NULL
ORDER BY p."created_at" DESC;


-- ============================================================
--  SECTION 6 — REPORTING QUERIES
-- ============================================================

-- Total collections by application type (current financial year)
-- FY = April to March; change the dates as needed
SELECT
    a."application_type",
    COUNT(*)                          AS total_payments,
    SUM(p."amount") / 100.0           AS total_collected_rs,
    MIN(p."updated_at")               AS first_payment,
    MAX(p."updated_at")               AS last_payment
FROM  "payments"     p
JOIN  "applications" a ON a."id" = p."application_id"
WHERE p."status"     = 'Completed'
  AND p."created_at" >= '2026-04-01'
  AND p."created_at" <  '2027-04-01'
GROUP BY a."application_type"
ORDER BY total_collected_rs DESC;


-- Invoice number sequence check — list last 10 invoices this FY
SELECT
    "invoice_no",
    (p."amount" / 100.0)  AS amount_rs,
    a."application_type",
    a."reference_number",
    u."email",
    p."updated_at"        AS paid_at
FROM  "payments"     p
JOIN  "applications" a ON a."id" = p."application_id"
JOIN  "users"        u ON u."id" = p."user_id"
WHERE p."invoice_no" IS NOT NULL
ORDER BY p."updated_at" DESC
LIMIT 10;


-- Payment status summary
SELECT
    "status",
    COUNT(*)                AS count,
    SUM("amount") / 100.0   AS total_rs
FROM  "payments"
GROUP BY "status";


-- ============================================================
--  SECTION 7 — ROLLBACK (DROP)
--  Run only if you need to undo the migration entirely
-- ============================================================

-- DROP VIEW  IF EXISTS "v_pending_payments";
-- DROP VIEW  IF EXISTS "v_completed_payments";
-- ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "payments_user_id_fkey";
-- ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "payments_application_id_fkey";
-- ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "payments_status_check";
-- DROP TABLE IF EXISTS "payments";
