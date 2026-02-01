CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE "StaffScheduleAssignment" (
    "id" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffScheduleAssignment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StaffScheduleAssignment_staffProfileId_idx" ON "StaffScheduleAssignment"("staffProfileId");
CREATE INDEX "StaffScheduleAssignment_scheduleId_idx" ON "StaffScheduleAssignment"("scheduleId");
CREATE INDEX "StaffScheduleAssignment_startDate_idx" ON "StaffScheduleAssignment"("startDate");
CREATE INDEX "StaffScheduleAssignment_endDate_idx" ON "StaffScheduleAssignment"("endDate");

ALTER TABLE "StaffScheduleAssignment" ADD CONSTRAINT "StaffScheduleAssignment_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "StaffProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffScheduleAssignment" ADD CONSTRAINT "StaffScheduleAssignment_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "ShiftSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "StaffScheduleAssignment" ("id", "staffProfileId", "scheduleId", "startDate", "endDate", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, "staffProfileId", "id", "startDate", NULL, NOW(), NOW()
FROM "ShiftSchedule"
WHERE "staffProfileId" IS NOT NULL;

ALTER TABLE "ShiftSchedule" DROP CONSTRAINT IF EXISTS "ShiftSchedule_staffProfileId_fkey";
DROP INDEX IF EXISTS "ShiftSchedule_staffProfileId_key";
ALTER TABLE "ShiftSchedule" DROP COLUMN "staffProfileId";

DROP INDEX IF EXISTS "ShiftSchedule_default_unique";
CREATE UNIQUE INDEX "ShiftSchedule_default_unique" ON "ShiftSchedule" ("isDefault") WHERE "isDefault" = true;
