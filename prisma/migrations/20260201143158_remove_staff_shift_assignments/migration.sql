/*
  Warnings:

  - You are about to drop the `StaffShiftAssignment` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "StaffShiftAssignment" DROP CONSTRAINT "StaffShiftAssignment_staffProfileId_fkey";

-- DropForeignKey
ALTER TABLE "StaffShiftAssignment" DROP CONSTRAINT "StaffShiftAssignment_templateId_fkey";

-- DropTable
DROP TABLE "StaffShiftAssignment";
