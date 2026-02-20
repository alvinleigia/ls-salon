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

const ADMIN_NAME = "Alvin Araujo"
const ADMIN_EMAIL = "alvinaraujo@gmail.com"
const ADMIN_PASSWORD = "password123"

async function main() {
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10)

  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      name: ADMIN_NAME,
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
      passwordHash,
    },
    create: {
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
      passwordHash,
    },
  })

  console.log(`Admin bootstrap complete for ${ADMIN_EMAIL}`)
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
