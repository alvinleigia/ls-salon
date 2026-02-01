ALTER TABLE "ShiftSchedule" DROP CONSTRAINT IF EXISTS "ShiftSchedule_staffProfileId_fkey";
ALTER TABLE "ShiftSchedule" ALTER COLUMN "weekOff2Weeks" DROP DEFAULT;
ALTER TABLE "ShiftSchedule" ADD CONSTRAINT "ShiftSchedule_staffProfileId_fkey"
FOREIGN KEY ("staffProfileId") REFERENCES "StaffProfile"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
