-- AlterTable
ALTER TABLE "applications" ADD COLUMN     "approval_number" TEXT,
ADD COLUMN     "assigned_ec_id" TEXT,
ADD COLUMN     "assigned_nodal_id" TEXT,
ADD COLUMN     "assigned_to_id" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "assigned_categories" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_assigned_nodal_id_fkey" FOREIGN KEY ("assigned_nodal_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_assigned_ec_id_fkey" FOREIGN KEY ("assigned_ec_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
