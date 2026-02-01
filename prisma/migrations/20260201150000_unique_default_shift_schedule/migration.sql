-- Ensure only one global default schedule exists (staffProfileId IS NULL).
UPDATE "ShiftSchedule"
SET "isDefault" = false
WHERE "isDefault" = true
  AND "staffProfileId" IS NULL
  AND "id" NOT IN (
    SELECT "id"
    FROM "ShiftSchedule"
    WHERE "isDefault" = true
      AND "staffProfileId" IS NULL
    ORDER BY "updatedAt" DESC
    LIMIT 1
  );

CREATE UNIQUE INDEX "ShiftSchedule_default_unique"
ON "ShiftSchedule" ("isDefault")
WHERE "isDefault" = true AND "staffProfileId" IS NULL;
