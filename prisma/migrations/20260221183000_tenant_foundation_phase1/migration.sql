-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ARCHIVED');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'OWNER';

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- Seed a default tenant for existing single-tenant data
INSERT INTO "Tenant" ("id", "name", "slug", "status", "createdAt", "updatedAt")
VALUES ('tenant_default', 'Default Tenant', 'default', 'ACTIVE', NOW(), NOW());

-- AlterTable (add nullable first for backfill)
ALTER TABLE "User" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "Invitation" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "AppSetting" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "AppSetting" ALTER COLUMN "id" DROP DEFAULT;

-- Backfill existing data into default tenant
UPDATE "User" SET "tenantId" = 'tenant_default' WHERE "tenantId" IS NULL;
UPDATE "Invitation" SET "tenantId" = 'tenant_default' WHERE "tenantId" IS NULL;
UPDATE "AuditLog" SET "tenantId" = 'tenant_default' WHERE "tenantId" IS NULL;
UPDATE "AppSetting" SET "tenantId" = 'tenant_default' WHERE "tenantId" IS NULL;

-- Enforce required tenant scope on settings first-slice models
ALTER TABLE "AppSetting" ALTER COLUMN "tenantId" SET NOT NULL;

-- Indexes
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");
CREATE INDEX "Tenant_status_idx" ON "Tenant"("status");
CREATE UNIQUE INDEX "AppSetting_tenantId_key" ON "AppSetting"("tenantId");
CREATE INDEX "AuditLog_tenantId_idx" ON "AuditLog"("tenantId");
CREATE INDEX "Invitation_tenantId_idx" ON "Invitation"("tenantId");
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");
CREATE UNIQUE INDEX "User_tenantId_email_key" ON "User"("tenantId", "email");

-- Foreign keys
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppSetting" ADD CONSTRAINT "AppSetting_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
