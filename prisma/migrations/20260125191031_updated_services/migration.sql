-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('STANDARD', 'PACKAGE');

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "type" "ServiceType" NOT NULL DEFAULT 'STANDARD';

-- CreateTable
CREATE TABLE "ServicePackageItem" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "itemServiceId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServicePackageItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServicePackageItem_packageId_idx" ON "ServicePackageItem"("packageId");

-- CreateIndex
CREATE INDEX "ServicePackageItem_itemServiceId_idx" ON "ServicePackageItem"("itemServiceId");

-- CreateIndex
CREATE UNIQUE INDEX "ServicePackageItem_packageId_itemServiceId_key" ON "ServicePackageItem"("packageId", "itemServiceId");

-- AddForeignKey
ALTER TABLE "ServicePackageItem" ADD CONSTRAINT "ServicePackageItem_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicePackageItem" ADD CONSTRAINT "ServicePackageItem_itemServiceId_fkey" FOREIGN KEY ("itemServiceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
