-- AlterTable
ALTER TABLE "StaffProfile" ADD COLUMN     "managerUserId" TEXT;

-- CreateIndex
CREATE INDEX "StaffProfile_managerUserId_idx" ON "StaffProfile"("managerUserId");

-- AddForeignKey
ALTER TABLE "StaffProfile" ADD CONSTRAINT "StaffProfile_managerUserId_fkey" FOREIGN KEY ("managerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
