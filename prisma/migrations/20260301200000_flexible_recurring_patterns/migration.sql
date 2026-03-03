CREATE TABLE "StaffFlexiblePattern" (
  "id" TEXT NOT NULL,
  "staffProfileId" TEXT NOT NULL,
  "name" TEXT,
  "cycleLengthWeeks" INTEGER NOT NULL DEFAULT 1,
  "validFrom" DATE NOT NULL,
  "validTo" DATE,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StaffFlexiblePattern_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StaffFlexiblePatternWeek" (
  "id" TEXT NOT NULL,
  "patternId" TEXT NOT NULL,
  "weekIndex" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StaffFlexiblePatternWeek_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StaffFlexiblePatternDay" (
  "id" TEXT NOT NULL,
  "weekId" TEXT NOT NULL,
  "day" "Weekday" NOT NULL,
  "isOff" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StaffFlexiblePatternDay_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StaffFlexiblePatternSlot" (
  "id" TEXT NOT NULL,
  "dayId" TEXT NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StaffFlexiblePatternSlot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StaffFlexiblePatternBreak" (
  "id" TEXT NOT NULL,
  "slotId" TEXT NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StaffFlexiblePatternBreak_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StaffFlexiblePattern_staffProfileId_idx" ON "StaffFlexiblePattern"("staffProfileId");
CREATE INDEX "StaffFlexiblePattern_validFrom_idx" ON "StaffFlexiblePattern"("validFrom");
CREATE INDEX "StaffFlexiblePattern_validTo_idx" ON "StaffFlexiblePattern"("validTo");
CREATE INDEX "StaffFlexiblePattern_isActive_idx" ON "StaffFlexiblePattern"("isActive");

CREATE UNIQUE INDEX "StaffFlexiblePatternWeek_patternId_weekIndex_key" ON "StaffFlexiblePatternWeek"("patternId", "weekIndex");
CREATE INDEX "StaffFlexiblePatternWeek_patternId_idx" ON "StaffFlexiblePatternWeek"("patternId");

CREATE UNIQUE INDEX "StaffFlexiblePatternDay_weekId_day_key" ON "StaffFlexiblePatternDay"("weekId", "day");
CREATE INDEX "StaffFlexiblePatternDay_weekId_idx" ON "StaffFlexiblePatternDay"("weekId");
CREATE INDEX "StaffFlexiblePatternDay_day_idx" ON "StaffFlexiblePatternDay"("day");

CREATE UNIQUE INDEX "StaffFlexiblePatternSlot_dayId_sortOrder_key" ON "StaffFlexiblePatternSlot"("dayId", "sortOrder");
CREATE INDEX "StaffFlexiblePatternSlot_dayId_idx" ON "StaffFlexiblePatternSlot"("dayId");

CREATE UNIQUE INDEX "StaffFlexiblePatternBreak_slotId_sortOrder_key" ON "StaffFlexiblePatternBreak"("slotId", "sortOrder");
CREATE INDEX "StaffFlexiblePatternBreak_slotId_idx" ON "StaffFlexiblePatternBreak"("slotId");

ALTER TABLE "StaffFlexiblePattern"
ADD CONSTRAINT "StaffFlexiblePattern_staffProfileId_fkey"
FOREIGN KEY ("staffProfileId") REFERENCES "StaffProfile"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StaffFlexiblePatternWeek"
ADD CONSTRAINT "StaffFlexiblePatternWeek_patternId_fkey"
FOREIGN KEY ("patternId") REFERENCES "StaffFlexiblePattern"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StaffFlexiblePatternDay"
ADD CONSTRAINT "StaffFlexiblePatternDay_weekId_fkey"
FOREIGN KEY ("weekId") REFERENCES "StaffFlexiblePatternWeek"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StaffFlexiblePatternSlot"
ADD CONSTRAINT "StaffFlexiblePatternSlot_dayId_fkey"
FOREIGN KEY ("dayId") REFERENCES "StaffFlexiblePatternDay"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StaffFlexiblePatternBreak"
ADD CONSTRAINT "StaffFlexiblePatternBreak_slotId_fkey"
FOREIGN KEY ("slotId") REFERENCES "StaffFlexiblePatternSlot"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
