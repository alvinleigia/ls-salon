-- CreateEnum
CREATE TYPE "LeaveGroupAssignmentMode" AS ENUM ('ALL_STAFF', 'SELECTED_STAFF');

-- CreateEnum
CREATE TYPE "LeaveGroupStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "LeaveGroup" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "assignmentMode" "LeaveGroupAssignmentMode" NOT NULL DEFAULT 'ALL_STAFF',
    "status" "LeaveGroupStatus" NOT NULL DEFAULT 'ACTIVE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveGroupLeave" (
    "id" TEXT NOT NULL,
    "leaveGroupId" TEXT NOT NULL,
    "leaveDefinitionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaveGroupLeave_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveGroupStaffAssignment" (
    "id" TEXT NOT NULL,
    "leaveGroupId" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaveGroupStaffAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeaveGroup_code_key" ON "LeaveGroup"("code");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveGroup_name_key" ON "LeaveGroup"("name");

-- CreateIndex
CREATE INDEX "LeaveGroup_status_idx" ON "LeaveGroup"("status");

-- CreateIndex
CREATE INDEX "LeaveGroup_assignmentMode_idx" ON "LeaveGroup"("assignmentMode");

-- CreateIndex
CREATE INDEX "LeaveGroup_sortOrder_idx" ON "LeaveGroup"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveGroupLeave_leaveGroupId_leaveDefinitionId_key" ON "LeaveGroupLeave"("leaveGroupId", "leaveDefinitionId");

-- CreateIndex
CREATE INDEX "LeaveGroupLeave_leaveGroupId_idx" ON "LeaveGroupLeave"("leaveGroupId");

-- CreateIndex
CREATE INDEX "LeaveGroupLeave_leaveDefinitionId_idx" ON "LeaveGroupLeave"("leaveDefinitionId");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveGroupStaffAssignment_leaveGroupId_staffProfileId_key" ON "LeaveGroupStaffAssignment"("leaveGroupId", "staffProfileId");

-- CreateIndex
CREATE INDEX "LeaveGroupStaffAssignment_leaveGroupId_idx" ON "LeaveGroupStaffAssignment"("leaveGroupId");

-- CreateIndex
CREATE INDEX "LeaveGroupStaffAssignment_staffProfileId_idx" ON "LeaveGroupStaffAssignment"("staffProfileId");

-- AddForeignKey
ALTER TABLE "LeaveGroupLeave" ADD CONSTRAINT "LeaveGroupLeave_leaveGroupId_fkey" FOREIGN KEY ("leaveGroupId") REFERENCES "LeaveGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveGroupLeave" ADD CONSTRAINT "LeaveGroupLeave_leaveDefinitionId_fkey" FOREIGN KEY ("leaveDefinitionId") REFERENCES "LeaveDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveGroupStaffAssignment" ADD CONSTRAINT "LeaveGroupStaffAssignment_leaveGroupId_fkey" FOREIGN KEY ("leaveGroupId") REFERENCES "LeaveGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveGroupStaffAssignment" ADD CONSTRAINT "LeaveGroupStaffAssignment_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "StaffProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
