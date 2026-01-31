ALTER TABLE "ShiftSchedule"
  ALTER COLUMN "staffProfileId" DROP NOT NULL;

ALTER TABLE "ShiftSchedule"
  ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;
