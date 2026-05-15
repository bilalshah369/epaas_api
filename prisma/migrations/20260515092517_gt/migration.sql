-- AlterTable
ALTER TABLE "appeals" ADD COLUMN     "attachment_url" TEXT,
ADD COLUMN     "authority_doc_url" TEXT;

-- AlterTable
ALTER TABLE "reviews" ADD COLUMN     "attachment_url" TEXT,
ADD COLUMN     "authority_doc_url" TEXT;
