-- AlterTable
ALTER TABLE "ShiftTemplate" ADD COLUMN "tenantId" TEXT;

-- AlterTable
ALTER TABLE "ShiftSchedule" ADD COLUMN "tenantId" TEXT;

-- Backfill existing rows
UPDATE "ShiftTemplate" SET "tenantId" = 'tenant_default' WHERE "tenantId" IS NULL;
UPDATE "ShiftSchedule" SET "tenantId" = 'tenant_default' WHERE "tenantId" IS NULL;

-- CreateIndex
CREATE INDEX "ShiftTemplate_tenantId_idx" ON "ShiftTemplate"("tenantId");

-- CreateIndex
CREATE INDEX "ShiftSchedule_tenantId_idx" ON "ShiftSchedule"("tenantId");

-- AddForeignKey
ALTER TABLE "ShiftTemplate" ADD CONSTRAINT "ShiftTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftSchedule" ADD CONSTRAINT "ShiftSchedule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
