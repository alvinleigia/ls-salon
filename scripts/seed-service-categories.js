/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const originalConnect = pool.connect.bind(pool);
pool.connect = (callback) => {
  const applyBypass = (client) =>
    client.query("SELECT set_config('app.rls_bypass', 'on', false)");

  if (typeof callback === "function") {
    originalConnect(async (error, client, done) => {
      if (error || !client) {
        callback(error, client, done);
        return;
      }
      try {
        await applyBypass(client);
        callback(undefined, client, done);
      } catch (settingsError) {
        done(settingsError);
        callback(settingsError, client, done);
      }
    });
    return;
  }

  return originalConnect().then(async (client) => {
    try {
      await applyBypass(client);
      return client;
    } catch (error) {
      client.release(error);
      throw error;
    }
  });
};

const prisma = new PrismaClient({
  adapter: new PrismaPg(pool, { disposeExternalPool: true }),
});

const categories = [
  {
    name: "Styling",
    description: "Blowouts, ironing, updos, and event styling.",
    status: "ACTIVE",
    sortOrder: 2,
  },
  {
    name: "Color",
    description: "Full color, root touch-ups, gloss, and toning.",
    status: "ACTIVE",
    sortOrder: 3,
  },
  {
    name: "Highlights",
    description: "Foils, balayage, and dimensional lightening.",
    status: "ACTIVE",
    sortOrder: 4,
  },
  {
    name: "Treatments",
    description: "Repair, hydration, and scalp treatments.",
    status: "ACTIVE",
    sortOrder: 5,
  },
  {
    name: "Texture",
    description: "Smoothing, keratin, and perm services.",
    status: "ACTIVE",
    sortOrder: 6,
  },
  {
    name: "Extensions",
    description: "Extension installs, moves, and maintenance.",
    status: "ACTIVE",
    sortOrder: 7,
  },
  {
    name: "Nails",
    description: "Manicure, pedicure, gel, and enhancements.",
    status: "ACTIVE",
    sortOrder: 8,
  },
  {
    name: "Skin & Wax",
    description: "Facials, brow, and waxing services.",
    status: "ACTIVE",
    sortOrder: 9,
  },
  {
    name: "Packages",
    description: "Bundled services at a preferred price.",
    status: "ACTIVE",
    sortOrder: 10,
  },
];

async function main() {
  await prisma.serviceCategory.createMany({
    data: categories,
    skipDuplicates: true,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
