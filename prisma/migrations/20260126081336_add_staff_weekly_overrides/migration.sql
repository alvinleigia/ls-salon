-- CreateTable
CREATE TABLE "StaffRosterWeeklyOverride" (
    "id" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "day" "Weekday" NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "StaffRosterWeeklyOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffRosterWeeklyPeriod" (
    "id" TEXT NOT NULL,
    "overrideId" TEXT NOT NULL,
    "kind" "AppSettingPeriodType" NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "StaffRosterWeeklyPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffRosterWeeklyOverride_staffProfileId_idx" ON "StaffRosterWeeklyOverride"("staffProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffRosterWeeklyOverride_staffProfileId_day_key" ON "StaffRosterWeeklyOverride"("staffProfileId", "day");

-- CreateIndex
CREATE INDEX "StaffRosterWeeklyPeriod_overrideId_idx" ON "StaffRosterWeeklyPeriod"("overrideId");

-- AddForeignKey
ALTER TABLE "StaffRosterWeeklyOverride" ADD CONSTRAINT "StaffRosterWeeklyOverride_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "StaffProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffRosterWeeklyPeriod" ADD CONSTRAINT "StaffRosterWeeklyPeriod_overrideId_fkey" FOREIGN KEY ("overrideId") REFERENCES "StaffRosterWeeklyOverride"("id") ON DELETE CASCADE ON UPDATE CASCADE;
