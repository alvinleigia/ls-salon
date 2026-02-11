-- CreateTable
CREATE TABLE "AppointmentOrderProductLine" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPriceCents" INTEGER NOT NULL,
    "discountType" "DiscountType" NOT NULL DEFAULT 'NONE',
    "discountValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxMode" "TaxMode" NOT NULL DEFAULT 'EXCLUSIVE',
    "taxIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lineSubtotalCents" INTEGER NOT NULL DEFAULT 0,
    "lineDiscountCents" INTEGER NOT NULL DEFAULT 0,
    "lineTaxCents" INTEGER NOT NULL DEFAULT 0,
    "lineTotalCents" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppointmentOrderProductLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AppointmentOrderProductLine_orderId_idx" ON "AppointmentOrderProductLine"("orderId");

-- CreateIndex
CREATE INDEX "AppointmentOrderProductLine_productId_idx" ON "AppointmentOrderProductLine"("productId");

-- AddForeignKey
ALTER TABLE "AppointmentOrderProductLine" ADD CONSTRAINT "AppointmentOrderProductLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "AppointmentOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentOrderProductLine" ADD CONSTRAINT "AppointmentOrderProductLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "InventoryProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
