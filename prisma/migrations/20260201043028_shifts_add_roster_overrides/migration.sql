-- CreateTable
CREATE TABLE "StaffShiftOverride" (
    "id" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "templateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffShiftOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffShiftOverride_staffProfileId_idx" ON "StaffShiftOverride"("staffProfileId");

-- CreateIndex
CREATE INDEX "StaffShiftOverride_date_idx" ON "StaffShiftOverride"("date");

-- CreateIndex
CREATE INDEX "StaffShiftOverride_templateId_idx" ON "StaffShiftOverride"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffShiftOverride_staffProfileId_date_key" ON "StaffShiftOverride"("staffProfileId", "date");

-- AddForeignKey
ALTER TABLE "StaffShiftOverride" ADD CONSTRAINT "StaffShiftOverride_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "StaffProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffShiftOverride" ADD CONSTRAINT "StaffShiftOverride_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ShiftTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
