-- Add tax mode and line-level tax snapshot fields for services and appointment order lines.
CREATE TYPE "TaxMode" AS ENUM ('EXCLUSIVE', 'INCLUSIVE');

ALTER TABLE "Service"
ADD COLUMN "taxMode" "TaxMode" NOT NULL DEFAULT 'EXCLUSIVE';

ALTER TABLE "AppointmentOrderLine"
ADD COLUMN "taxMode" "TaxMode" NOT NULL DEFAULT 'EXCLUSIVE',
ADD COLUMN "taxIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "lineTaxCents" INTEGER NOT NULL DEFAULT 0;
