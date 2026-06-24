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

const services = [
  {
    name: "Women's Haircut",
    description: "Wash, cut, and finish.",
    durationMinutes: 60,
    priceCents: 6500,
    status: "ACTIVE",
    category: "Haircuts",
  },
  {
    name: "Men's Haircut",
    description: "Classic cut and style.",
    durationMinutes: 45,
    priceCents: 4000,
    status: "ACTIVE",
    category: "Haircuts",
  },
  {
    name: "Blowout",
    description: "Shampoo, blow-dry, and finish.",
    durationMinutes: 45,
    priceCents: 4500,
    status: "ACTIVE",
    category: "Styling",
  },
  {
    name: "Updo",
    description: "Event-ready styling.",
    durationMinutes: 60,
    priceCents: 7500,
    status: "ACTIVE",
    category: "Styling",
  },
  {
    name: "Single Process Color",
    description: "Root-to-end color application.",
    durationMinutes: 90,
    priceCents: 9500,
    status: "ACTIVE",
    category: "Color",
  },
  {
    name: "Root Touch-Up",
    description: "Regrowth coverage.",
    durationMinutes: 75,
    priceCents: 7500,
    status: "ACTIVE",
    category: "Color",
  },
  {
    name: "Balayage",
    description: "Soft, natural highlights.",
    durationMinutes: 150,
    priceCents: 18000,
    status: "ACTIVE",
    category: "Highlights",
  },
  {
    name: "Partial Highlights",
    description: "Dimensional highlights.",
    durationMinutes: 120,
    priceCents: 12000,
    status: "ACTIVE",
    category: "Highlights",
  },
  {
    name: "Deep Conditioning",
    description: "Hydrating repair treatment.",
    durationMinutes: 20,
    priceCents: 2500,
    status: "ACTIVE",
    category: "Treatments",
  },
  {
    name: "Scalp Treatment",
    description: "Revitalize scalp and hair.",
    durationMinutes: 30,
    priceCents: 3500,
    status: "ACTIVE",
    category: "Treatments",
  },
  {
    name: "Keratin Smoothing",
    description: "Frizz-reducing treatment.",
    durationMinutes: 180,
    priceCents: 25000,
    status: "ACTIVE",
    category: "Texture",
  },
  {
    name: "Perm",
    description: "Texture and curl enhancement.",
    durationMinutes: 150,
    priceCents: 16000,
    status: "ACTIVE",
    category: "Texture",
  },
  {
    name: "Extension Install",
    description: "Full extension application.",
    durationMinutes: 180,
    priceCents: 30000,
    status: "ACTIVE",
    category: "Extensions",
  },
  {
    name: "Extension Move-Up",
    description: "Reposition and refresh extensions.",
    durationMinutes: 120,
    priceCents: 18000,
    status: "ACTIVE",
    category: "Extensions",
  },
  {
    name: "Signature Manicure",
    description: "Nail shaping and polish.",
    durationMinutes: 40,
    priceCents: 3000,
    status: "ACTIVE",
    category: "Nails",
  },
  {
    name: "Gel Manicure",
    description: "Long-lasting gel finish.",
    durationMinutes: 50,
    priceCents: 4500,
    status: "ACTIVE",
    category: "Nails",
  },
  {
    name: "Classic Facial",
    description: "Cleansing and hydration.",
    durationMinutes: 60,
    priceCents: 8500,
    status: "ACTIVE",
    category: "Skin & Wax",
  },
  {
    name: "Brow Wax",
    description: "Shape and clean up brows.",
    durationMinutes: 20,
    priceCents: 2000,
    status: "ACTIVE",
    category: "Skin & Wax",
  },
  {
    name: "Self-Care Package",
    description: "Haircut + blowout + deep conditioning.",
    durationMinutes: 120,
    priceCents: 12000,
    status: "ACTIVE",
    category: "Packages",
    type: "PACKAGE",
    items: ["Women's Haircut", "Blowout", "Deep Conditioning"],
  },
];

async function main() {
  const categories = await prisma.serviceCategory.findMany({
    select: { id: true, name: true },
  });
  const categoryMap = new Map(
    categories.map((category) => [category.name, category.id])
  );

  const data = services
    .map((service) => {
      const categoryId = categoryMap.get(service.category);
      if (!categoryId) return null;
      return {
        name: service.name,
        description: service.description,
        durationMinutes: service.durationMinutes,
        priceCents: service.priceCents,
        status: service.status,
        type: service.type || "STANDARD",
        categoryId,
      };
    })
    .filter((service) => service !== null)
    .map((service) => service);

  if (data.length === 0) return;

  await prisma.service.createMany({
    data,
    skipDuplicates: true,
  });

  const packageDefinitions = services.filter((service) => service.type === "PACKAGE");
  if (!packageDefinitions.length) return;

  const createdServices = await prisma.service.findMany({
    select: { id: true, name: true },
  });
  const serviceMap = new Map(
    createdServices.map((service) => [service.name, service.id])
  );

  for (const pack of packageDefinitions) {
    const packageId = serviceMap.get(pack.name);
    if (!packageId || !pack.items) continue;
    const packageItems = pack.items
      .map((name, index) => {
        const itemServiceId = serviceMap.get(name);
        if (!itemServiceId) return null;
        return { packageId, itemServiceId, sortOrder: index };
      })
      .filter((item) => item !== null);

    if (packageItems.length) {
      await prisma.servicePackageItem.createMany({
        data: packageItems,
        skipDuplicates: true,
      });
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
