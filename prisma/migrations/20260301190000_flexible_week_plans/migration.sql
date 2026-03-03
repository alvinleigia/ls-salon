CREATE TABLE "StaffFlexibleWeekPlan" (
  "id" TEXT NOT NULL,
  "staffProfileId" TEXT NOT NULL,
  "weekStartDate" DATE NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StaffFlexibleWeekPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StaffFlexibleWeekDay" (
  "id" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "day" "Weekday" NOT NULL,
  "isOff" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StaffFlexibleWeekDay_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StaffFlexibleWeekSlot" (
  "id" TEXT NOT NULL,
  "dayId" TEXT NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StaffFlexibleWeekSlot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StaffFlexibleWeekBreak" (
  "id" TEXT NOT NULL,
  "slotId" TEXT NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StaffFlexibleWeekBreak_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StaffFlexibleWeekPlan_staffProfileId_weekStartDate_key"
ON "StaffFlexibleWeekPlan"("staffProfileId", "weekStartDate");

CREATE INDEX "StaffFlexibleWeekPlan_staffProfileId_idx"
ON "StaffFlexibleWeekPlan"("staffProfileId");

CREATE INDEX "StaffFlexibleWeekPlan_weekStartDate_idx"
ON "StaffFlexibleWeekPlan"("weekStartDate");

CREATE UNIQUE INDEX "StaffFlexibleWeekDay_planId_day_key"
ON "StaffFlexibleWeekDay"("planId", "day");

CREATE INDEX "StaffFlexibleWeekDay_planId_idx"
ON "StaffFlexibleWeekDay"("planId");

CREATE INDEX "StaffFlexibleWeekDay_day_idx"
ON "StaffFlexibleWeekDay"("day");

CREATE UNIQUE INDEX "StaffFlexibleWeekSlot_dayId_sortOrder_key"
ON "StaffFlexibleWeekSlot"("dayId", "sortOrder");

CREATE INDEX "StaffFlexibleWeekSlot_dayId_idx"
ON "StaffFlexibleWeekSlot"("dayId");

CREATE UNIQUE INDEX "StaffFlexibleWeekBreak_slotId_sortOrder_key"
ON "StaffFlexibleWeekBreak"("slotId", "sortOrder");

CREATE INDEX "StaffFlexibleWeekBreak_slotId_idx"
ON "StaffFlexibleWeekBreak"("slotId");

ALTER TABLE "StaffFlexibleWeekPlan"
ADD CONSTRAINT "StaffFlexibleWeekPlan_staffProfileId_fkey"
FOREIGN KEY ("staffProfileId") REFERENCES "StaffProfile"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StaffFlexibleWeekDay"
ADD CONSTRAINT "StaffFlexibleWeekDay_planId_fkey"
FOREIGN KEY ("planId") REFERENCES "StaffFlexibleWeekPlan"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StaffFlexibleWeekSlot"
ADD CONSTRAINT "StaffFlexibleWeekSlot_dayId_fkey"
FOREIGN KEY ("dayId") REFERENCES "StaffFlexibleWeekDay"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StaffFlexibleWeekBreak"
ADD CONSTRAINT "StaffFlexibleWeekBreak_slotId_fkey"
FOREIGN KEY ("slotId") REFERENCES "StaffFlexibleWeekSlot"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
