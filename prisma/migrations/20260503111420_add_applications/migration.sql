-- CreateTable
CREATE TABLE "applications" (
    "id" TEXT NOT NULL,
    "reference_number" TEXT NOT NULL,
    "applicant_id" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "address" TEXT NOT NULL DEFAULT '',
    "application_type" TEXT NOT NULL,
    "food_category" TEXT NOT NULL DEFAULT '',
    "stage" TEXT NOT NULL DEFAULT 'Draft',
    "submitted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "applications_reference_number_key" ON "applications"("reference_number");

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_applicant_id_fkey" FOREIGN KEY ("applicant_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
