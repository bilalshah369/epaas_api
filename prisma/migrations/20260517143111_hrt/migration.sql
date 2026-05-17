/*
  Warnings:

  - A unique constraint covering the columns `[query_id]` on the table `extension_requests` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "appeals" ADD COLUMN     "attachment_url" TEXT,
ADD COLUMN     "authority_doc_url" TEXT;

-- AlterTable
ALTER TABLE "extension_requests" ADD COLUMN     "query_id" TEXT;

-- AlterTable
ALTER TABLE "reviews" ADD COLUMN     "attachment_url" TEXT,
ADD COLUMN     "authority_doc_url" TEXT;

-- CreateTable
CREATE TABLE "withdrawal_requests" (
    "id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "requested_by_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "justification" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "withdrawal_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "extension_requests_query_id_key" ON "extension_requests"("query_id");

-- AddForeignKey
ALTER TABLE "extension_requests" ADD CONSTRAINT "extension_requests_query_id_fkey" FOREIGN KEY ("query_id") REFERENCES "queries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
