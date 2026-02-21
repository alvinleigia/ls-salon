-- DropIndex
DROP INDEX "LeaveDefinition_code_key";

-- DropIndex
DROP INDEX "LeaveDefinition_name_key";

-- DropIndex
DROP INDEX "LeaveGroup_code_key";

-- DropIndex
DROP INDEX "LeaveGroup_name_key";

-- AlterTable
ALTER TABLE "LeaveDefinition" ADD COLUMN "tenantId" TEXT;

-- AlterTable
ALTER TABLE "LeaveGroup" ADD COLUMN "tenantId" TEXT;

-- AlterTable
ALTER TABLE "LeaveRequest" ADD COLUMN "tenantId" TEXT;

-- Backfill existing rows
UPDATE "LeaveDefinition" SET "tenantId" = 'tenant_default' WHERE "tenantId" IS NULL;
UPDATE "LeaveGroup" SET "tenantId" = 'tenant_default' WHERE "tenantId" IS NULL;
UPDATE "LeaveRequest" SET "tenantId" = 'tenant_default' WHERE "tenantId" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "LeaveDefinition_tenantId_code_key" ON "LeaveDefinition"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveDefinition_tenantId_name_key" ON "LeaveDefinition"("tenantId", "name");

-- CreateIndex
CREATE INDEX "LeaveDefinition_tenantId_idx" ON "LeaveDefinition"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveGroup_tenantId_code_key" ON "LeaveGroup"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveGroup_tenantId_name_key" ON "LeaveGroup"("tenantId", "name");

-- CreateIndex
CREATE INDEX "LeaveGroup_tenantId_idx" ON "LeaveGroup"("tenantId");

-- CreateIndex
CREATE INDEX "LeaveRequest_tenantId_idx" ON "LeaveRequest"("tenantId");

-- AddForeignKey
ALTER TABLE "LeaveDefinition" ADD CONSTRAINT "LeaveDefinition_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveGroup" ADD CONSTRAINT "LeaveGroup_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
