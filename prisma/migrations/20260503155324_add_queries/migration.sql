-- CreateTable
CREATE TABLE "queries" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "asked_by_id" TEXT NOT NULL,
    "response" TEXT,
    "responded_by_id" TEXT,
    "responded_at" TIMESTAMP(3),
    "reverted_from_stage" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "queries_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "queries" ADD CONSTRAINT "queries_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queries" ADD CONSTRAINT "queries_asked_by_id_fkey" FOREIGN KEY ("asked_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queries" ADD CONSTRAINT "queries_responded_by_id_fkey" FOREIGN KEY ("responded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
