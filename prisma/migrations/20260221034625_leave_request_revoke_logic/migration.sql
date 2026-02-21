-- AlterEnum
ALTER TYPE "LeaveRequestStatus" ADD VALUE 'REVOKED';

-- AlterTable
ALTER TABLE "LeaveRequest" ADD COLUMN     "revokeReason" TEXT,
ADD COLUMN     "revokedAt" TIMESTAMP(3),
ADD COLUMN     "revokedByUserId" TEXT;

-- CreateIndex
CREATE INDEX "LeaveRequest_revokedByUserId_idx" ON "LeaveRequest"("revokedByUserId");

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_revokedByUserId_fkey" FOREIGN KEY ("revokedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
