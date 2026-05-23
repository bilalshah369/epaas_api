-- =============================================================================
-- E-PAAS Content Management Tables
-- Run this script directly on the pfadmin PostgreSQL server.
-- Safe to re-run: all statements use IF NOT EXISTS / OR REPLACE guards.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Trigger function — keeps updated_at current on every UPDATE
--    (mirrors Prisma @updatedAt behaviour for direct SQL / non-ORM updates)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- 2. circulars
--    Official orders / circulars shown on the public landing page.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "circulars" (
    "id"         TEXT        NOT NULL,
    "date"       TEXT        NOT NULL,              -- display date, e.g. "10 Apr 2026"
    "ref_number" TEXT        NOT NULL,              -- e.g. FSSAI/EPAAS/2026/CIR-14
    "title"      TEXT        NOT NULL,
    "tag"        TEXT        NOT NULL DEFAULT 'General',  -- NSF | CA | AA | rPET | General
    "published"  BOOLEAN     NOT NULL DEFAULT true,
    "sort_order" INTEGER     NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "circulars_pkey" PRIMARY KEY ("id")
);

-- Index: public landing page queries filter by published + sort by sort_order / created_at
CREATE INDEX IF NOT EXISTS "circulars_published_order_idx"
    ON "circulars" ("published", "sort_order", "created_at" DESC);

-- Trigger: auto-update updated_at
DROP TRIGGER IF EXISTS "circulars_set_updated_at" ON "circulars";
CREATE TRIGGER "circulars_set_updated_at"
    BEFORE UPDATE ON "circulars"
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. notifications
--    Portal notices shown on the public landing page.
--    type = 'Alert' renders as the highlighted maintenance-notice box.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "notifications" (
    "id"         TEXT        NOT NULL,
    "date"       TEXT        NOT NULL,              -- display date, e.g. "12 Apr 2026"
    "title"      TEXT        NOT NULL,
    "type"       TEXT        NOT NULL DEFAULT 'Update',  -- Alert | Meeting | Approval | Compliance | Support | Update
    "body"       TEXT,                              -- optional — used for Alert type only
    "published"  BOOLEAN     NOT NULL DEFAULT true,
    "sort_order" INTEGER     NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- Index: public landing page queries filter by published + sort by sort_order / created_at
CREATE INDEX IF NOT EXISTS "notifications_published_order_idx"
    ON "notifications" ("published", "sort_order", "created_at" DESC);

-- Trigger: auto-update updated_at
DROP TRIGGER IF EXISTS "notifications_set_updated_at" ON "notifications";
CREATE TRIGGER "notifications_set_updated_at"
    BEFORE UPDATE ON "notifications"
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. Verify
-- ---------------------------------------------------------------------------
SELECT
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns c
     WHERE c.table_name = t.table_name AND c.table_schema = 'public') AS column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN ('circulars', 'notifications')
ORDER BY table_name;
