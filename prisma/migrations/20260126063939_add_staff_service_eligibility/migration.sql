-- CreateTable
CREATE TABLE "StaffServiceEligibility" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffServiceEligibility_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffServiceEligibility_userId_idx" ON "StaffServiceEligibility"("userId");

-- CreateIndex
CREATE INDEX "StaffServiceEligibility_serviceId_idx" ON "StaffServiceEligibility"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffServiceEligibility_userId_serviceId_key" ON "StaffServiceEligibility"("userId", "serviceId");

-- AddForeignKey
ALTER TABLE "StaffServiceEligibility" ADD CONSTRAINT "StaffServiceEligibility_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffServiceEligibility" ADD CONSTRAINT "StaffServiceEligibility_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
