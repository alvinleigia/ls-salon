CREATE TABLE "ShiftSchedule" (
  "id" TEXT NOT NULL,
  "name" TEXT,
  "staffProfileId" TEXT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "weekOffDay1" "Weekday" NOT NULL,
  "weekOffDay2" "Weekday",
  "weekOff2Weeks" INTEGER[] NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShiftSchedule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ShiftSchedule_staffProfileId_key" ON "ShiftSchedule"("staffProfileId");
CREATE INDEX "ShiftSchedule_startDate_idx" ON "ShiftSchedule"("startDate");

CREATE TABLE "ShiftScheduleBlock" (
  "id" TEXT NOT NULL,
  "scheduleId" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "repeatDays" INTEGER NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "ShiftScheduleBlock_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ShiftScheduleBlock_scheduleId_idx" ON "ShiftScheduleBlock"("scheduleId");
CREATE INDEX "ShiftScheduleBlock_templateId_idx" ON "ShiftScheduleBlock"("templateId");

ALTER TABLE "ShiftSchedule"
  ADD CONSTRAINT "ShiftSchedule_staffProfileId_fkey"
  FOREIGN KEY ("staffProfileId") REFERENCES "StaffProfile"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ShiftScheduleBlock"
  ADD CONSTRAINT "ShiftScheduleBlock_scheduleId_fkey"
  FOREIGN KEY ("scheduleId") REFERENCES "ShiftSchedule"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ShiftScheduleBlock"
  ADD CONSTRAINT "ShiftScheduleBlock_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "ShiftTemplate"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
