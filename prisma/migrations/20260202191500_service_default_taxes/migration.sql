CREATE TABLE "ServiceTax" (
    "serviceId" TEXT NOT NULL,
    "taxId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceTax_pkey" PRIMARY KEY ("serviceId","taxId")
);

CREATE INDEX "ServiceTax_taxId_idx" ON "ServiceTax"("taxId");

ALTER TABLE "ServiceTax"
ADD CONSTRAINT "ServiceTax_serviceId_fkey"
FOREIGN KEY ("serviceId") REFERENCES "Service"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ServiceTax"
ADD CONSTRAINT "ServiceTax_taxId_fkey"
FOREIGN KEY ("taxId") REFERENCES "Tax"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
