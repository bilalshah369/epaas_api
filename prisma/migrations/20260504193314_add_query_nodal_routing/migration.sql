-- AlterTable
ALTER TABLE "queries" ADD COLUMN     "nodal_forwarded_at" TIMESTAMP(3),
ADD COLUMN     "nodal_fwd_response_at" TIMESTAMP(3),
ADD COLUMN     "origin_stage" TEXT;
