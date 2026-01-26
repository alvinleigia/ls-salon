-- CreateEnum
CREATE TYPE "StaffDocumentCategory" AS ENUM ('ADDRESS', 'ID', 'OTHER');

-- CreateTable
CREATE TABLE "StaffDocument" (
    "id" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" "StaffDocumentCategory" NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffDocument_staffProfileId_idx" ON "StaffDocument"("staffProfileId");

-- AddForeignKey
ALTER TABLE "StaffDocument" ADD CONSTRAINT "StaffDocument_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "StaffProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
