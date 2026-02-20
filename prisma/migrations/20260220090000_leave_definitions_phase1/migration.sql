-- CreateEnum
CREATE TYPE "LeaveDefinitionType" AS ENUM ('PAID', 'LAY_OFF', 'UNPAID', 'RESTRICTED', 'COMPENSATORY', 'TOUR_ON_DUTY');

-- CreateEnum
CREATE TYPE "LeaveDefinitionAllowedUsers" AS ENUM ('MALE', 'FEMALE', 'ALL');

-- CreateEnum
CREATE TYPE "LeaveDefinitionStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "LeaveDefinition" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "leaveType" "LeaveDefinitionType" NOT NULL,
    "allowedUsers" "LeaveDefinitionAllowedUsers" NOT NULL DEFAULT 'ALL',
    "minDaysPerRequest" INTEGER NOT NULL DEFAULT 1,
    "maxDaysPerRequest" INTEGER NOT NULL DEFAULT 30,
    "allowWithOtherLeaves" BOOLEAN NOT NULL DEFAULT true,
    "priorEntryAllowed" BOOLEAN NOT NULL DEFAULT false,
    "noticeDays" INTEGER NOT NULL DEFAULT 0,
    "allowCarryForward" BOOLEAN NOT NULL DEFAULT false,
    "maxConsecutiveDays" INTEGER NOT NULL DEFAULT 30,
    "maxPendingRequests" INTEGER NOT NULL DEFAULT 3,
    "status" "LeaveDefinitionStatus" NOT NULL DEFAULT 'ACTIVE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveDefinitionNonClubbable" (
    "id" TEXT NOT NULL,
    "leaveDefinitionId" TEXT NOT NULL,
    "blockedLeaveId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaveDefinitionNonClubbable_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeaveDefinition_code_key" ON "LeaveDefinition"("code");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveDefinition_name_key" ON "LeaveDefinition"("name");

-- CreateIndex
CREATE INDEX "LeaveDefinition_status_idx" ON "LeaveDefinition"("status");

-- CreateIndex
CREATE INDEX "LeaveDefinition_leaveType_idx" ON "LeaveDefinition"("leaveType");

-- CreateIndex
CREATE INDEX "LeaveDefinition_sortOrder_idx" ON "LeaveDefinition"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "leave_def_nonclubbable_pair_key" ON "LeaveDefinitionNonClubbable"("leaveDefinitionId", "blockedLeaveId");

-- CreateIndex
CREATE INDEX "LeaveDefinitionNonClubbable_leaveDefinitionId_idx" ON "LeaveDefinitionNonClubbable"("leaveDefinitionId");

-- CreateIndex
CREATE INDEX "LeaveDefinitionNonClubbable_blockedLeaveId_idx" ON "LeaveDefinitionNonClubbable"("blockedLeaveId");

-- AddForeignKey
ALTER TABLE "LeaveDefinitionNonClubbable" ADD CONSTRAINT "LeaveDefinitionNonClubbable_leaveDefinitionId_fkey" FOREIGN KEY ("leaveDefinitionId") REFERENCES "LeaveDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveDefinitionNonClubbable" ADD CONSTRAINT "LeaveDefinitionNonClubbable_blockedLeaveId_fkey" FOREIGN KEY ("blockedLeaveId") REFERENCES "LeaveDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
