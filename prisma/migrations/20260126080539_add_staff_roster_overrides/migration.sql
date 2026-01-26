-- CreateTable
CREATE TABLE "StaffRosterOverride" (
    "id" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffRosterOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffRosterOverridePeriod" (
    "id" TEXT NOT NULL,
    "overrideId" TEXT NOT NULL,
    "kind" "AppSettingPeriodType" NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "StaffRosterOverridePeriod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffRosterOverride_staffProfileId_idx" ON "StaffRosterOverride"("staffProfileId");

-- CreateIndex
CREATE INDEX "StaffRosterOverride_date_idx" ON "StaffRosterOverride"("date");

-- CreateIndex
CREATE UNIQUE INDEX "StaffRosterOverride_staffProfileId_date_key" ON "StaffRosterOverride"("staffProfileId", "date");

-- CreateIndex
CREATE INDEX "StaffRosterOverridePeriod_overrideId_idx" ON "StaffRosterOverridePeriod"("overrideId");

-- AddForeignKey
ALTER TABLE "StaffRosterOverride" ADD CONSTRAINT "StaffRosterOverride_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "StaffProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffRosterOverridePeriod" ADD CONSTRAINT "StaffRosterOverridePeriod_overrideId_fkey" FOREIGN KEY ("overrideId") REFERENCES "StaffRosterOverride"("id") ON DELETE CASCADE ON UPDATE CASCADE;
