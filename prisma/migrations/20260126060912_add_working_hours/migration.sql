-- CreateEnum
CREATE TYPE "Weekday" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateEnum
CREATE TYPE "AppSettingPeriodType" AS ENUM ('WORK', 'BREAK');

-- CreateTable
CREATE TABLE "AppSettingDay" (
    "id" TEXT NOT NULL,
    "settingId" TEXT NOT NULL,
    "day" "Weekday" NOT NULL,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AppSettingDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSettingPeriod" (
    "id" TEXT NOT NULL,
    "dayId" TEXT NOT NULL,
    "kind" "AppSettingPeriodType" NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AppSettingPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppSettingDay_settingId_day_key" ON "AppSettingDay"("settingId", "day");

-- CreateIndex
CREATE INDEX "AppSettingPeriod_dayId_idx" ON "AppSettingPeriod"("dayId");

-- AddForeignKey
ALTER TABLE "AppSettingDay" ADD CONSTRAINT "AppSettingDay_settingId_fkey" FOREIGN KEY ("settingId") REFERENCES "AppSetting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppSettingPeriod" ADD CONSTRAINT "AppSettingPeriod_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "AppSettingDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;
