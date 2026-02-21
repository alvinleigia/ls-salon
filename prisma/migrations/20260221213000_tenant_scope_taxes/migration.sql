-- DropIndex
DROP INDEX "Tax_name_key";

-- AlterTable
ALTER TABLE "Tax" ADD COLUMN "tenantId" TEXT;

-- Backfill existing tax rows to default tenant
UPDATE "Tax" SET "tenantId" = 'tenant_default' WHERE "tenantId" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Tax_tenantId_name_key" ON "Tax"("tenantId", "name");

-- CreateIndex
CREATE INDEX "Tax_tenantId_idx" ON "Tax"("tenantId");

-- AddForeignKey
ALTER TABLE "Tax" ADD CONSTRAINT "Tax_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
