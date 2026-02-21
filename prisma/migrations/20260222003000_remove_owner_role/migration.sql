-- Remove OWNER from Role enum by remapping existing rows to ADMIN first.

UPDATE "User"
SET "role" = 'ADMIN'
WHERE "role" = 'OWNER';

UPDATE "Invitation"
SET "role" = 'ADMIN'
WHERE "role" = 'OWNER';

UPDATE "AuditLog"
SET "actorRole" = 'ADMIN'
WHERE "actorRole" = 'OWNER';

ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "Invitation" ALTER COLUMN "role" DROP DEFAULT;

CREATE TYPE "Role_new" AS ENUM ('ADMIN', 'MANAGER', 'STAFF', 'CUSTOMER');

ALTER TABLE "User"
ALTER COLUMN "role" TYPE "Role_new"
USING ("role"::text::"Role_new");

ALTER TABLE "Invitation"
ALTER COLUMN "role" TYPE "Role_new"
USING ("role"::text::"Role_new");

ALTER TABLE "AuditLog"
ALTER COLUMN "actorRole" TYPE "Role_new"
USING ("actorRole"::text::"Role_new");

DROP TYPE "Role";
ALTER TYPE "Role_new" RENAME TO "Role";

ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'CUSTOMER';
ALTER TABLE "Invitation" ALTER COLUMN "role" SET DEFAULT 'CUSTOMER';
