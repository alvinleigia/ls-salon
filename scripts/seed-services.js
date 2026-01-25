const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

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
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
