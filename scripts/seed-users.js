/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require("@prisma/client")
const { PrismaPg } = require("@prisma/adapter-pg")
const bcrypt = require("bcryptjs")
const { Pool } = require("pg")

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

const originalConnect = pool.connect.bind(pool)
pool.connect = (callback) => {
  const applyBypass = (client) =>
    client.query("SELECT set_config('app.rls_bypass', 'on', false)")

  if (typeof callback === "function") {
    originalConnect(async (error, client, done) => {
      if (error || !client) {
        callback(error, client, done)
        return
      }
      try {
        await applyBypass(client)
        callback(undefined, client, done)
      } catch (settingsError) {
        done(settingsError)
        callback(settingsError, client, done)
      }
    })
    return
  }

  return originalConnect().then(async (client) => {
    try {
      await applyBypass(client)
      return client
    } catch (error) {
      client.release(error)
      throw error
    }
  })
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(pool, { disposeExternalPool: true }),
})

const seedUsers = async () => {
  const passwordHash = await bcrypt.hash("password123", 10)
  const users = [
    {
      name: "Admin User",
      email: "admin@ls-salon.test",
      role: "ADMIN",
    },
    {
      name: "Staff One",
      email: "staff1@ls-salon.test",
      role: "STAFF",
    },
    {
      name: "Staff Two",
      email: "staff2@ls-salon.test",
      role: "STAFF",
    },
    {
      name: "Customer One",
      email: "customer1@ls-salon.test",
      role: "CUSTOMER",
    },
  ]

  for (const user of users) {
    const record = await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        role: user.role,
        passwordHash,
        status: "ACTIVE",
      },
      create: {
        name: user.name,
        email: user.email,
        role: user.role,
        passwordHash,
        status: "ACTIVE",
      },
    })

    if (user.role === "STAFF") {
      await prisma.staffProfile.upsert({
        where: { userId: record.id },
        update: {},
        create: { userId: record.id },
      })
    }
  }
}

const main = async () => {
  try {
    await seedUsers()
    console.log("Seeded users.")
  } catch (error) {
    console.error(error)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

void main()
