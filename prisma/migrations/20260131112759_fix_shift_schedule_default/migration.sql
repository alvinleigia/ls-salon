-- DropForeignKey
ALTER TABLE "ShiftSchedule" DROP CONSTRAINT "ShiftSchedule_staffProfileId_fkey";

-- AlterTable
ALTER TABLE "ShiftSchedule" ALTER COLUMN "weekOff2Weeks" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "ShiftSchedule" ADD CONSTRAINT "ShiftSchedule_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "StaffProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
