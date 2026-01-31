/*
  Warnings:

  - You are about to drop the `StaffRosterOverride` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `StaffRosterOverridePeriod` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `StaffRosterWeeklyOverride` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `StaffRosterWeeklyPeriod` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "StaffRosterOverride" DROP CONSTRAINT "StaffRosterOverride_staffProfileId_fkey";

-- DropForeignKey
ALTER TABLE "StaffRosterOverridePeriod" DROP CONSTRAINT "StaffRosterOverridePeriod_overrideId_fkey";

-- DropForeignKey
ALTER TABLE "StaffRosterWeeklyOverride" DROP CONSTRAINT "StaffRosterWeeklyOverride_staffProfileId_fkey";

-- DropForeignKey
ALTER TABLE "StaffRosterWeeklyPeriod" DROP CONSTRAINT "StaffRosterWeeklyPeriod_overrideId_fkey";

-- DropTable
DROP TABLE "StaffRosterOverride";

-- DropTable
DROP TABLE "StaffRosterOverridePeriod";

-- DropTable
DROP TABLE "StaffRosterWeeklyOverride";

-- DropTable
DROP TABLE "StaffRosterWeeklyPeriod";

-- CreateTable
CREATE TABLE "ShiftTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShiftTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftTemplatePeriod" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "kind" "AppSettingPeriodType" NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ShiftTemplatePeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffShiftAssignment" (
    "id" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "day" "Weekday" NOT NULL,
    "templateId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffShiftAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShiftTemplate_isActive_idx" ON "ShiftTemplate"("isActive");

-- CreateIndex
CREATE INDEX "ShiftTemplate_createdAt_idx" ON "ShiftTemplate"("createdAt");

-- CreateIndex
CREATE INDEX "ShiftTemplatePeriod_templateId_idx" ON "ShiftTemplatePeriod"("templateId");

-- CreateIndex
CREATE INDEX "StaffShiftAssignment_staffProfileId_idx" ON "StaffShiftAssignment"("staffProfileId");

-- CreateIndex
CREATE INDEX "StaffShiftAssignment_templateId_idx" ON "StaffShiftAssignment"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffShiftAssignment_staffProfileId_day_key" ON "StaffShiftAssignment"("staffProfileId", "day");

-- AddForeignKey
ALTER TABLE "ShiftTemplatePeriod" ADD CONSTRAINT "ShiftTemplatePeriod_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ShiftTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffShiftAssignment" ADD CONSTRAINT "StaffShiftAssignment_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "StaffProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffShiftAssignment" ADD CONSTRAINT "StaffShiftAssignment_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ShiftTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
