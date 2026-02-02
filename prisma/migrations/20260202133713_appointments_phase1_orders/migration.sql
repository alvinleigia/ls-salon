-- CreateEnum
CREATE TYPE "AppointmentOrderStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'COMPLETED', 'CANCELED');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('NONE', 'PERCENT', 'AMOUNT');

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "orderLineId" TEXT;

-- CreateTable
CREATE TABLE "AppointmentOrder" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "appointmentDate" DATE NOT NULL,
    "appointmentStartAt" TIMESTAMP(3) NOT NULL,
    "status" "AppointmentOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "customerNote" TEXT,
    "internalNote" TEXT,
    "subtotalCents" INTEGER NOT NULL DEFAULT 0,
    "lineDiscountCents" INTEGER NOT NULL DEFAULT 0,
    "couponDiscountCents" INTEGER NOT NULL DEFAULT 0,
    "taxCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppointmentOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentOrderLine" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "serviceId" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "durationMinutes" INTEGER NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "discountType" "DiscountType" NOT NULL DEFAULT 'NONE',
    "discountValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lineSubtotalCents" INTEGER NOT NULL DEFAULT 0,
    "lineDiscountCents" INTEGER NOT NULL DEFAULT 0,
    "lineTotalCents" INTEGER NOT NULL DEFAULT 0,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppointmentOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentOrderCoupon" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "discountType" "DiscountType" NOT NULL DEFAULT 'NONE',
    "discountValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppointmentOrderCoupon_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AppointmentOrder_customerId_idx" ON "AppointmentOrder"("customerId");

-- CreateIndex
CREATE INDEX "AppointmentOrder_appointmentDate_idx" ON "AppointmentOrder"("appointmentDate");

-- CreateIndex
CREATE INDEX "AppointmentOrder_appointmentStartAt_idx" ON "AppointmentOrder"("appointmentStartAt");

-- CreateIndex
CREATE INDEX "AppointmentOrder_status_idx" ON "AppointmentOrder"("status");

-- CreateIndex
CREATE INDEX "AppointmentOrderLine_orderId_idx" ON "AppointmentOrderLine"("orderId");

-- CreateIndex
CREATE INDEX "AppointmentOrderLine_serviceId_idx" ON "AppointmentOrderLine"("serviceId");

-- CreateIndex
CREATE INDEX "AppointmentOrderLine_staffProfileId_idx" ON "AppointmentOrderLine"("staffProfileId");

-- CreateIndex
CREATE INDEX "AppointmentOrderLine_startAt_idx" ON "AppointmentOrderLine"("startAt");

-- CreateIndex
CREATE INDEX "AppointmentOrderLine_endAt_idx" ON "AppointmentOrderLine"("endAt");

-- CreateIndex
CREATE INDEX "AppointmentOrderCoupon_orderId_idx" ON "AppointmentOrderCoupon"("orderId");

-- CreateIndex
CREATE INDEX "AppointmentOrderCoupon_code_idx" ON "AppointmentOrderCoupon"("code");

-- CreateIndex
CREATE INDEX "Appointment_orderLineId_idx" ON "Appointment"("orderLineId");

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_orderLineId_fkey" FOREIGN KEY ("orderLineId") REFERENCES "AppointmentOrderLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentOrder" ADD CONSTRAINT "AppointmentOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentOrderLine" ADD CONSTRAINT "AppointmentOrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "AppointmentOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentOrderLine" ADD CONSTRAINT "AppointmentOrderLine_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentOrderLine" ADD CONSTRAINT "AppointmentOrderLine_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "StaffProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentOrderCoupon" ADD CONSTRAINT "AppointmentOrderCoupon_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "AppointmentOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
