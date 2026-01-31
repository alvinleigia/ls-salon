const { PrismaClient } = require("@prisma/client")
const bcrypt = require("bcryptjs")

const prisma = new PrismaClient()

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
