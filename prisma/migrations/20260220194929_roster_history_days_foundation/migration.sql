-- CreateEnum
CREATE TYPE "StaffRosterDaySource" AS ENUM ('SCHEDULE', 'OVERRIDE', 'LEAVE', 'UNAVAILABLE', 'OFF');

-- CreateTable
CREATE TABLE "StaffRosterHistoryDay" (
    "id" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "source" "StaffRosterDaySource" NOT NULL,
    "templateId" TEXT,
    "templateName" TEXT,
    "startTime" TEXT,
    "endTime" TEXT,
    "paidMinutes" INTEGER NOT NULL DEFAULT 0,
    "leaveRequestId" TEXT,
    "leaveDefinitionCode" TEXT,
    "leaveDefinitionName" TEXT,
    "leaveReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffRosterHistoryDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffRosterHistoryDay_date_idx" ON "StaffRosterHistoryDay"("date");

-- CreateIndex
CREATE INDEX "StaffRosterHistoryDay_staffProfileId_idx" ON "StaffRosterHistoryDay"("staffProfileId");

-- CreateIndex
CREATE INDEX "StaffRosterHistoryDay_source_idx" ON "StaffRosterHistoryDay"("source");

-- CreateIndex
CREATE UNIQUE INDEX "StaffRosterHistoryDay_staffProfileId_date_key" ON "StaffRosterHistoryDay"("staffProfileId", "date");

-- AddForeignKey
ALTER TABLE "StaffRosterHistoryDay" ADD CONSTRAINT "StaffRosterHistoryDay_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "StaffProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffRosterHistoryDay" ADD CONSTRAINT "StaffRosterHistoryDay_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ShiftTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffRosterHistoryDay" ADD CONSTRAINT "StaffRosterHistoryDay_leaveRequestId_fkey" FOREIGN KEY ("leaveRequestId") REFERENCES "LeaveRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
