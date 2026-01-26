-- CreateTable
CREATE TABLE "AppSettingOverride" (
    "id" TEXT NOT NULL,
    "settingId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AppSettingOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSettingOverridePeriod" (
    "id" TEXT NOT NULL,
    "overrideId" TEXT NOT NULL,
    "kind" "AppSettingPeriodType" NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AppSettingOverridePeriod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AppSettingOverride_settingId_idx" ON "AppSettingOverride"("settingId");

-- CreateIndex
CREATE INDEX "AppSettingOverride_date_idx" ON "AppSettingOverride"("date");

-- CreateIndex
CREATE UNIQUE INDEX "AppSettingOverride_settingId_date_key" ON "AppSettingOverride"("settingId", "date");

-- CreateIndex
CREATE INDEX "AppSettingOverridePeriod_overrideId_idx" ON "AppSettingOverridePeriod"("overrideId");

-- AddForeignKey
ALTER TABLE "AppSettingOverride" ADD CONSTRAINT "AppSettingOverride_settingId_fkey" FOREIGN KEY ("settingId") REFERENCES "AppSetting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppSettingOverridePeriod" ADD CONSTRAINT "AppSettingOverridePeriod_overrideId_fkey" FOREIGN KEY ("overrideId") REFERENCES "AppSettingOverride"("id") ON DELETE CASCADE ON UPDATE CASCADE;
