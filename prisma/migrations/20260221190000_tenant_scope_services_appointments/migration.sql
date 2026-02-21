-- DropIndex
DROP INDEX "Coupon_code_key";

-- DropIndex
DROP INDEX "ServiceCategory_name_key";

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "tenantId" TEXT;
ALTER TABLE "AppointmentOrder" ADD COLUMN     "tenantId" TEXT;
ALTER TABLE "Coupon" ADD COLUMN     "tenantId" TEXT;
ALTER TABLE "Service" ADD COLUMN     "tenantId" TEXT;
ALTER TABLE "ServiceCategory" ADD COLUMN     "tenantId" TEXT;

-- Backfill existing rows into default tenant
UPDATE "ServiceCategory" SET "tenantId" = 'tenant_default' WHERE "tenantId" IS NULL;
UPDATE "Service" SET "tenantId" = 'tenant_default' WHERE "tenantId" IS NULL;
UPDATE "Appointment" SET "tenantId" = 'tenant_default' WHERE "tenantId" IS NULL;
UPDATE "AppointmentOrder" SET "tenantId" = 'tenant_default' WHERE "tenantId" IS NULL;
UPDATE "Coupon" SET "tenantId" = 'tenant_default' WHERE "tenantId" IS NULL;

-- CreateIndex
CREATE INDEX "Appointment_tenantId_idx" ON "Appointment"("tenantId");
CREATE INDEX "AppointmentOrder_tenantId_idx" ON "AppointmentOrder"("tenantId");
CREATE INDEX "Coupon_tenantId_idx" ON "Coupon"("tenantId");
CREATE UNIQUE INDEX "Coupon_tenantId_code_key" ON "Coupon"("tenantId", "code");
CREATE INDEX "Service_tenantId_idx" ON "Service"("tenantId");
CREATE INDEX "ServiceCategory_tenantId_idx" ON "ServiceCategory"("tenantId");
CREATE UNIQUE INDEX "ServiceCategory_tenantId_name_key" ON "ServiceCategory"("tenantId", "name");

-- AddForeignKey
ALTER TABLE "ServiceCategory" ADD CONSTRAINT "ServiceCategory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Service" ADD CONSTRAINT "Service_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppointmentOrder" ADD CONSTRAINT "AppointmentOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
