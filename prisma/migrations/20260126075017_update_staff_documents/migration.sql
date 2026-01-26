/*
  Warnings:

  - You are about to drop the column `category` on the `StaffDocument` table. All the data in the column will be lost.
  - You are about to drop the column `label` on the `StaffDocument` table. All the data in the column will be lost.
  - You are about to drop the column `verificationNotes` on the `StaffProfile` table. All the data in the column will be lost.
  - You are about to drop the column `verificationStatus` on the `StaffProfile` table. All the data in the column will be lost.
  - Added the required column `type` to the `StaffDocument` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "StaffDocumentType" AS ENUM ('ADDRESS', 'ID', 'OTHER');

-- AlterTable
ALTER TABLE "StaffDocument" DROP COLUMN "category",
DROP COLUMN "label",
ADD COLUMN     "number" TEXT,
ADD COLUMN     "type" "StaffDocumentType" NOT NULL,
ADD COLUMN     "validFrom" TIMESTAMP(3),
ADD COLUMN     "validTo" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "StaffProfile" DROP COLUMN "verificationNotes",
DROP COLUMN "verificationStatus";

-- DropEnum
DROP TYPE "StaffDocumentCategory";

-- DropEnum
DROP TYPE "StaffVerificationStatus";
