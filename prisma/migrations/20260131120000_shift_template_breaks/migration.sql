-- Shift templates now store a single shift range with optional breaks.
-- Migrate existing period-based data to start/end + breaks.

ALTER TABLE "ShiftTemplate"
  ADD COLUMN "startTime" TEXT,
  ADD COLUMN "endTime" TEXT;

CREATE TABLE "ShiftTemplateBreak" (
  "id" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "ShiftTemplateBreak_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ShiftTemplateBreak_templateId_idx" ON "ShiftTemplateBreak"("templateId");

ALTER TABLE "ShiftTemplateBreak"
  ADD CONSTRAINT "ShiftTemplateBreak_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "ShiftTemplate"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Populate breaks from existing BREAK periods.
INSERT INTO "ShiftTemplateBreak" ("id", "templateId", "startTime", "endTime", "sortOrder")
SELECT
  md5(random()::text || clock_timestamp()::text),
  "templateId",
  "startTime",
  "endTime",
  COALESCE("sortOrder", 0)
FROM "ShiftTemplatePeriod"
WHERE "kind" = 'BREAK';

-- Set shift start/end from WORK periods; fall back to any period if needed.
UPDATE "ShiftTemplate" st
SET
  "startTime" = COALESCE(
    (SELECT MIN("startTime") FROM "ShiftTemplatePeriod" p WHERE p."templateId" = st."id" AND p."kind" = 'WORK'),
    (SELECT MIN("startTime") FROM "ShiftTemplatePeriod" p WHERE p."templateId" = st."id")
  ),
  "endTime" = COALESCE(
    (SELECT MAX("endTime") FROM "ShiftTemplatePeriod" p WHERE p."templateId" = st."id" AND p."kind" = 'WORK'),
    (SELECT MAX("endTime") FROM "ShiftTemplatePeriod" p WHERE p."templateId" = st."id")
  );

UPDATE "ShiftTemplate"
SET
  "startTime" = COALESCE("startTime", '09:00'),
  "endTime" = COALESCE("endTime", '18:00');

ALTER TABLE "ShiftTemplate"
  ALTER COLUMN "startTime" SET NOT NULL,
  ALTER COLUMN "endTime" SET NOT NULL;

DROP TABLE "ShiftTemplatePeriod";
