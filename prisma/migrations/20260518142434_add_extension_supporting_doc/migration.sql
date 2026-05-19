-- AlterTable: add optional supporting_document column to extension_requests
ALTER TABLE "extension_requests" ADD COLUMN "supporting_document" TEXT;
