-- CreateEnum
CREATE TYPE "StaffSchedulingMode" AS ENUM ('STANDARD', 'FLEXIBLE');

-- AlterTable
ALTER TABLE "StaffProfile"
ADD COLUMN "schedulingMode" "StaffSchedulingMode" NOT NULL DEFAULT 'STANDARD';

-- CreateTable
CREATE TABLE "StaffFlexibleAvailability" (
    "id" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffFlexibleAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffFlexibleAvailability_staffProfileId_idx" ON "StaffFlexibleAvailability"("staffProfileId");

-- CreateIndex
CREATE INDEX "StaffFlexibleAvailability_date_idx" ON "StaffFlexibleAvailability"("date");

-- CreateIndex
CREATE UNIQUE INDEX "StaffFlexibleAvailability_staffProfileId_date_sortOrder_key" ON "StaffFlexibleAvailability"("staffProfileId", "date", "sortOrder");

-- AddForeignKey
ALTER TABLE "StaffFlexibleAvailability"
ADD CONSTRAINT "StaffFlexibleAvailability_staffProfileId_fkey"
FOREIGN KEY ("staffProfileId") REFERENCES "StaffProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
