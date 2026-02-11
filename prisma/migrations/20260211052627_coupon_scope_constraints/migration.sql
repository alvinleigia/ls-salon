-- CreateEnum
CREATE TYPE "CouponAppliesTo" AS ENUM ('ORDER', 'SERVICE_LINES', 'PRODUCT_LINES');

-- CreateEnum
CREATE TYPE "CouponStackingMode" AS ENUM ('STACKABLE', 'EXCLUSIVE');

-- AlterTable
ALTER TABLE "Coupon" ADD COLUMN     "allowedCategoryIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "allowedProductIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "allowedServiceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "appliesTo" "CouponAppliesTo" NOT NULL DEFAULT 'ORDER',
ADD COLUMN     "minSubtotalCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "stackingMode" "CouponStackingMode" NOT NULL DEFAULT 'STACKABLE';
