-- AlterTable
ALTER TABLE "LeaveDefinition"
ADD COLUMN "weekOffSingleSideAllowed" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "weekOffBothSideAllowed" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "holidaySingleSideAllowed" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "holidayBothSideAllowed" BOOLEAN NOT NULL DEFAULT true;
