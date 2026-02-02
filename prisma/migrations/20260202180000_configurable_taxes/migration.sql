-- Remove legacy billing defaults from global settings
ALTER TABLE "AppSetting"
DROP COLUMN "taxPercent",
DROP COLUMN "serviceChargePercent";

-- Remove service charge aggregate from appointment orders
ALTER TABLE "AppointmentOrder"
DROP COLUMN "serviceChargeCents";

-- Create tax definitions
CREATE TABLE "Tax" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "percent" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tax_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Tax_name_key" ON "Tax"("name");
CREATE INDEX "Tax_isActive_idx" ON "Tax"("isActive");
CREATE INDEX "Tax_sortOrder_idx" ON "Tax"("sortOrder");

-- Persist selected taxes per order (snapshotting name/percent/taxCents)
CREATE TABLE "AppointmentOrderTax" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "taxId" TEXT,
    "name" TEXT NOT NULL,
    "percent" DOUBLE PRECISION NOT NULL,
    "taxCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppointmentOrderTax_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AppointmentOrderTax_orderId_idx" ON "AppointmentOrderTax"("orderId");
CREATE INDEX "AppointmentOrderTax_taxId_idx" ON "AppointmentOrderTax"("taxId");

ALTER TABLE "AppointmentOrderTax"
ADD CONSTRAINT "AppointmentOrderTax_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "AppointmentOrder"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AppointmentOrderTax"
ADD CONSTRAINT "AppointmentOrderTax_taxId_fkey"
FOREIGN KEY ("taxId") REFERENCES "Tax"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
