import "dotenv/config"
import bcrypt from "bcryptjs"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient, Role, UserStatus } from "@prisma/client"
import { Pool } from "pg"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
})

const PLATFORM_TENANT_SLUG = (
  process.env.PLATFORM_ADMIN_TENANT_SLUG?.trim().toLowerCase() || "platform"
)
const PLATFORM_TENANT_NAME = process.env.PLATFORM_ADMIN_TENANT_NAME?.trim() || "Platform Tenant"
const ADMIN_NAME = process.env.PLATFORM_ADMIN_NAME?.trim() || "Platform Admin"
const ADMIN_EMAIL = process.env.PLATFORM_ADMIN_EMAIL?.trim().toLowerCase() || "platform-admin@ls-salon.test"
const ADMIN_PASSWORD = process.env.PLATFORM_ADMIN_PASSWORD?.trim() || "password123"

async function main() {
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10)
  const tenant = await prisma.tenant.upsert({
    where: { slug: PLATFORM_TENANT_SLUG },
    update: { status: "ACTIVE" },
    create: {
      slug: PLATFORM_TENANT_SLUG,
      name: PLATFORM_TENANT_NAME,
      status: "ACTIVE",
    },
    select: { id: true },
  })

  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      tenantId: tenant.id,
      name: ADMIN_NAME,
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
      passwordHash,
    },
    create: {
      tenantId: tenant.id,
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
      passwordHash,
    },
  })

  await prisma.appSetting.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: { tenantId: tenant.id },
  })

  console.log(`Platform admin bootstrap complete for ${ADMIN_EMAIL} on tenant slug ${PLATFORM_TENANT_SLUG}`)
}

main()
  .catch((error) => {
    console.error("Failed to bootstrap admin user:", error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
