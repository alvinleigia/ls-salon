-- DropIndex
DROP INDEX "InventoryCategory_name_key";

-- DropIndex
DROP INDEX "InventoryProduct_sku_key";

-- DropIndex
DROP INDEX "PurchaseOrder_orderNumber_key";

-- AlterTable
ALTER TABLE "InventoryCategory" ADD COLUMN     "tenantId" TEXT;
ALTER TABLE "InventoryProduct" ADD COLUMN     "tenantId" TEXT;
ALTER TABLE "InventoryStockMovement" ADD COLUMN     "tenantId" TEXT;
ALTER TABLE "PurchaseOrder" ADD COLUMN     "tenantId" TEXT;
ALTER TABLE "Supplier" ADD COLUMN     "tenantId" TEXT;

-- Backfill
UPDATE "InventoryCategory" SET "tenantId" = 'tenant_default' WHERE "tenantId" IS NULL;
UPDATE "Supplier" SET "tenantId" = 'tenant_default' WHERE "tenantId" IS NULL;
UPDATE "InventoryProduct" SET "tenantId" = 'tenant_default' WHERE "tenantId" IS NULL;
UPDATE "PurchaseOrder" SET "tenantId" = 'tenant_default' WHERE "tenantId" IS NULL;
UPDATE "InventoryStockMovement" SET "tenantId" = 'tenant_default' WHERE "tenantId" IS NULL;

-- CreateIndex
CREATE INDEX "InventoryCategory_tenantId_idx" ON "InventoryCategory"("tenantId");
CREATE UNIQUE INDEX "InventoryCategory_tenantId_name_key" ON "InventoryCategory"("tenantId", "name");
CREATE INDEX "InventoryProduct_tenantId_idx" ON "InventoryProduct"("tenantId");
CREATE UNIQUE INDEX "InventoryProduct_tenantId_sku_key" ON "InventoryProduct"("tenantId", "sku");
CREATE INDEX "InventoryStockMovement_tenantId_idx" ON "InventoryStockMovement"("tenantId");
CREATE INDEX "PurchaseOrder_tenantId_idx" ON "PurchaseOrder"("tenantId");
CREATE UNIQUE INDEX "PurchaseOrder_tenantId_orderNumber_key" ON "PurchaseOrder"("tenantId", "orderNumber");
CREATE INDEX "Supplier_tenantId_idx" ON "Supplier"("tenantId");

-- AddForeignKey
ALTER TABLE "InventoryCategory" ADD CONSTRAINT "InventoryCategory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryProduct" ADD CONSTRAINT "InventoryProduct_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryStockMovement" ADD CONSTRAINT "InventoryStockMovement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
