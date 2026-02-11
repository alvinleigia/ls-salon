-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TaxRegistrationType') THEN
    CREATE TYPE "TaxRegistrationType" AS ENUM ('VAT', 'GST', 'SALES_TAX_ID', 'EIN', 'OTHER');
  END IF;
END $$;

-- AlterTable
ALTER TABLE "Supplier"
  ADD COLUMN IF NOT EXISTS "isTaxRegistered" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "taxRegistrationType" "TaxRegistrationType",
  ADD COLUMN IF NOT EXISTS "taxRegistrationNumber" TEXT;

-- Backfill from legacy taxId
UPDATE "Supplier"
SET
  "isTaxRegistered" = CASE
    WHEN COALESCE(TRIM("taxId"), '') <> '' THEN true
    ELSE "isTaxRegistered"
  END,
  "taxRegistrationType" = CASE
    WHEN COALESCE(TRIM("taxId"), '') <> '' AND "taxRegistrationType" IS NULL THEN 'OTHER'::"TaxRegistrationType"
    ELSE "taxRegistrationType"
  END,
  "taxRegistrationNumber" = CASE
    WHEN COALESCE(TRIM("taxId"), '') <> '' AND COALESCE(TRIM("taxRegistrationNumber"), '') = '' THEN TRIM("taxId")
    ELSE "taxRegistrationNumber"
  END;

-- Drop legacy column
ALTER TABLE "Supplier" DROP COLUMN IF EXISTS "taxId";
