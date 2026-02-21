import { randomUUID } from "crypto"
import { NextResponse } from "next/server"
import {
  AppointmentOrderStatus,
  AppointmentStatus,
  InventoryCategoryStatus,
  InventoryProductStatus,
  LeaveDefinitionAllowedUsers,
  LeaveDefinitionStatus,
  LeaveDefinitionType,
  LeaveGroupAssignmentMode,
  LeaveGroupStatus,
  PurchaseOrderStatus,
  Role,
  ServiceType,
  SupplierStatus,
  UserStatus,
  Weekday,
} from "@prisma/client"
import bcrypt from "bcryptjs"
import { z } from "zod"

import { auth } from "@/auth"
import {
  createApiLogContext,
  logApiRequestError,
  logApiRequestStart,
  logApiRequestSuccess,
  withRequestId,
} from "@/lib/api-logging"
import { canManageUsers } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

const seedGroupValues = [
  "taxes",
  "users",
  "serviceCatalog",
  "inventoryCatalog",
  "purchases",
  "leaves",
  "shifts",
  "appointments",
  "coupons",
] as const

type SeedGroup = (typeof seedGroupValues)[number]

const clearModuleValues = [
  "appointments",
  "coupons",
  "purchases",
  "inventory",
  "shifts",
  "services",
  "taxes",
  "users",
] as const

type ClearModule = (typeof clearModuleValues)[number]
type ClearMode = "strict" | "include_dependents"

const requestSchema = z.object({
  action: z.enum(["seed", "clear", "previewClear", "previewModulesClear", "clearModules"]),
  groups: z.array(z.enum(seedGroupValues)).optional(),
  modules: z.array(z.enum(clearModuleValues)).optional(),
  mode: z.enum(["strict", "include_dependents"]).optional(),
})

const seededUsers = [
  { name: "Manager One", email: "manager1@ls-salon.test", role: Role.MANAGER },
  { name: "Manager Two", email: "manager2@ls-salon.test", role: Role.MANAGER },
  { name: "Staff One", email: "staff1@ls-salon.test", role: Role.STAFF },
  { name: "Staff Two", email: "staff2@ls-salon.test", role: Role.STAFF },
  { name: "Staff Three", email: "staff3@ls-salon.test", role: Role.STAFF },
  { name: "Staff Four", email: "staff4@ls-salon.test", role: Role.STAFF },
  { name: "Staff Five", email: "staff5@ls-salon.test", role: Role.STAFF },
  { name: "Customer One", email: "customer1@ls-salon.test", role: Role.CUSTOMER },
  { name: "Customer Two", email: "customer2@ls-salon.test", role: Role.CUSTOMER },
  { name: "Customer Three", email: "customer3@ls-salon.test", role: Role.CUSTOMER },
  { name: "Customer Four", email: "customer4@ls-salon.test", role: Role.CUSTOMER },
  { name: "Customer Five", email: "customer5@ls-salon.test", role: Role.CUSTOMER },
]

const serviceCategorySeeds = [
  { name: "Hair Services", description: "Haircut, styling, and coloring." },
  { name: "Skin Services", description: "Facials and skin care services." },
]

const serviceSeeds = [
  {
    name: "Haircut",
    description: "Standard haircut.",
    durationMinutes: 45,
    priceCents: 3500,
    type: ServiceType.STANDARD,
    categoryName: "Hair Services",
    taxNames: ["GST 18%"],
  },
  {
    name: "Hair Coloring",
    description: "Global hair coloring.",
    durationMinutes: 90,
    priceCents: 6500,
    type: ServiceType.STANDARD,
    categoryName: "Hair Services",
    taxNames: ["GST 18%"],
  },
  {
    name: "Classic Facial",
    description: "Cleansing and hydration facial.",
    durationMinutes: 60,
    priceCents: 5000,
    type: ServiceType.STANDARD,
    categoryName: "Skin Services",
    taxNames: ["GST 18%"],
  },
  {
    name: "Beard Trim",
    description: "Precision beard shaping.",
    durationMinutes: 30,
    priceCents: 2200,
    type: ServiceType.STANDARD,
    categoryName: "Hair Services",
    taxNames: ["GST 18%"],
  },
  {
    name: "Hair Spa",
    description: "Repair and hydration treatment.",
    durationMinutes: 60,
    priceCents: 4200,
    type: ServiceType.STANDARD,
    categoryName: "Hair Services",
    taxNames: ["GST 18%"],
  },
  {
    name: "Keratin Treatment",
    description: "Smoothing and anti-frizz treatment.",
    durationMinutes: 120,
    priceCents: 9800,
    type: ServiceType.STANDARD,
    categoryName: "Hair Services",
    taxNames: ["GST 18%"],
  },
  {
    name: "Express Cleanup Facial",
    description: "Quick refresh facial.",
    durationMinutes: 35,
    priceCents: 2800,
    type: ServiceType.STANDARD,
    categoryName: "Skin Services",
    taxNames: ["GST 18%"],
  },
  {
    name: "Detan Facial",
    description: "Pigmentation-focused facial.",
    durationMinutes: 75,
    priceCents: 5600,
    type: ServiceType.STANDARD,
    categoryName: "Skin Services",
    taxNames: ["GST 18%"],
  },
  {
    name: "Glow Ritual Package",
    description: "Hair + skin glow combo package.",
    durationMinutes: 105,
    priceCents: 8200,
    type: ServiceType.PACKAGE,
    categoryName: "Skin Services",
    taxNames: ["GST 18%"],
    packageItemNames: ["Hair Spa", "Classic Facial"],
  },
  {
    name: "Bridal Prep Package",
    description: "Pre-event hair and skin prep package.",
    durationMinutes: 165,
    priceCents: 12400,
    type: ServiceType.PACKAGE,
    categoryName: "Hair Services",
    taxNames: ["GST 18%"],
    packageItemNames: ["Hair Coloring", "Detan Facial"],
  },
]

const inventoryCategorySeeds = [
  { name: "Hair Care", description: "Shampoo, conditioner, and treatment products." },
  { name: "Skin Care", description: "Cleansers and masks." },
]

const supplierSeeds = [
  { name: "Glow Supplies", email: "sales@glow-supplies.test", phone: "555-0101" },
  { name: "Pro Beauty Wholesale", email: "orders@probeauty.test", phone: "555-0102" },
]

const productSeeds = [
  {
    sku: "HC-SHAMPOO-001",
    name: "Repair Shampoo",
    categoryName: "Hair Care",
    supplierName: "Glow Supplies",
    costPriceCents: 900,
    mrpCents: 1500,
    reorderPoint: 10,
    reorderQty: 30,
    initialQty: 60,
    taxNames: ["VAT 5%"],
  },
  {
    sku: "HC-SERUM-001",
    name: "Hair Serum",
    categoryName: "Hair Care",
    supplierName: "Pro Beauty Wholesale",
    costPriceCents: 700,
    mrpCents: 1200,
    reorderPoint: 8,
    reorderQty: 25,
    initialQty: 40,
    taxNames: ["VAT 5%"],
  },
  {
    sku: "SC-MASK-001",
    name: "Hydration Face Mask",
    categoryName: "Skin Care",
    supplierName: "Glow Supplies",
    costPriceCents: 500,
    mrpCents: 900,
    reorderPoint: 12,
    reorderQty: 40,
    initialQty: 80,
    taxNames: ["VAT 5%"],
  },
]

const couponSeeds = [
  {
    code: "WELCOME10",
    name: "Welcome 10%",
    discountType: "PERCENT" as const,
    discountValue: 10,
    appliesTo: "ORDER" as const,
  },
  {
    code: "SKIN500",
    name: "Skin care flat 5.00",
    discountType: "AMOUNT" as const,
    discountValue: 5,
    appliesTo: "SERVICE_LINES" as const,
  },
]

const shiftTemplateSeeds = [
  {
    name: "Morning Shift",
    description: "Morning operations template.",
    color: "#0ea5e9",
    startTime: "09:00",
    endTime: "17:00",
    breaks: [{ startTime: "13:00", endTime: "13:30", sortOrder: 0 }],
  },
  {
    name: "Evening Shift",
    description: "Evening operations template.",
    color: "#f59e0b",
    startTime: "12:00",
    endTime: "20:00",
    breaks: [{ startTime: "16:00", endTime: "16:30", sortOrder: 0 }],
  },
]

const leaveDefinitionSeeds = [
  {
    code: "PAID",
    name: "Paid Leave",
    leaveType: LeaveDefinitionType.PAID,
    allowedUsers: LeaveDefinitionAllowedUsers.ALL,
    minDaysPerRequest: 1,
    maxDaysPerRequest: 15,
    allowWithOtherLeaves: true,
    priorEntryAllowed: true,
    noticeDays: 1,
    allowCarryForward: true,
    weekOffSingleSideAllowed: true,
    weekOffBothSideAllowed: true,
    holidaySingleSideAllowed: true,
    holidayBothSideAllowed: true,
    maxConsecutiveDays: 10,
    maxPendingRequests: 2,
    status: LeaveDefinitionStatus.ACTIVE,
    sortOrder: 1,
    blockedCodes: ["LAYOFF"],
  },
  {
    code: "LAYOFF",
    name: "Lay Off",
    leaveType: LeaveDefinitionType.LAY_OFF,
    allowedUsers: LeaveDefinitionAllowedUsers.ALL,
    minDaysPerRequest: 1,
    maxDaysPerRequest: 30,
    allowWithOtherLeaves: false,
    priorEntryAllowed: false,
    noticeDays: 0,
    allowCarryForward: false,
    weekOffSingleSideAllowed: true,
    weekOffBothSideAllowed: false,
    holidaySingleSideAllowed: true,
    holidayBothSideAllowed: false,
    maxConsecutiveDays: 20,
    maxPendingRequests: 1,
    status: LeaveDefinitionStatus.ACTIVE,
    sortOrder: 2,
    blockedCodes: ["PAID", "COMP"],
  },
  {
    code: "UNPAID",
    name: "Unpaid Leave",
    leaveType: LeaveDefinitionType.UNPAID,
    allowedUsers: LeaveDefinitionAllowedUsers.ALL,
    minDaysPerRequest: 1,
    maxDaysPerRequest: 30,
    allowWithOtherLeaves: true,
    priorEntryAllowed: true,
    noticeDays: 0,
    allowCarryForward: false,
    weekOffSingleSideAllowed: true,
    weekOffBothSideAllowed: true,
    holidaySingleSideAllowed: true,
    holidayBothSideAllowed: true,
    maxConsecutiveDays: 30,
    maxPendingRequests: 3,
    status: LeaveDefinitionStatus.ACTIVE,
    sortOrder: 3,
    blockedCodes: [],
  },
  {
    code: "RESTRICTED",
    name: "Restricted Holiday",
    leaveType: LeaveDefinitionType.RESTRICTED,
    allowedUsers: LeaveDefinitionAllowedUsers.ALL,
    minDaysPerRequest: 1,
    maxDaysPerRequest: 2,
    allowWithOtherLeaves: true,
    priorEntryAllowed: false,
    noticeDays: 3,
    allowCarryForward: false,
    weekOffSingleSideAllowed: false,
    weekOffBothSideAllowed: false,
    holidaySingleSideAllowed: false,
    holidayBothSideAllowed: false,
    maxConsecutiveDays: 2,
    maxPendingRequests: 2,
    status: LeaveDefinitionStatus.ACTIVE,
    sortOrder: 4,
    blockedCodes: [],
  },
  {
    code: "COMP",
    name: "Compensatory Off",
    leaveType: LeaveDefinitionType.COMPENSATORY,
    allowedUsers: LeaveDefinitionAllowedUsers.ALL,
    minDaysPerRequest: 1,
    maxDaysPerRequest: 3,
    allowWithOtherLeaves: false,
    priorEntryAllowed: true,
    noticeDays: 0,
    allowCarryForward: false,
    weekOffSingleSideAllowed: false,
    weekOffBothSideAllowed: false,
    holidaySingleSideAllowed: false,
    holidayBothSideAllowed: false,
    maxConsecutiveDays: 3,
    maxPendingRequests: 2,
    status: LeaveDefinitionStatus.ACTIVE,
    sortOrder: 5,
    blockedCodes: ["LAYOFF"],
  },
  {
    code: "TOD",
    name: "Tour / On Duty",
    leaveType: LeaveDefinitionType.TOUR_ON_DUTY,
    allowedUsers: LeaveDefinitionAllowedUsers.ALL,
    minDaysPerRequest: 1,
    maxDaysPerRequest: 20,
    allowWithOtherLeaves: false,
    priorEntryAllowed: true,
    noticeDays: 2,
    allowCarryForward: false,
    weekOffSingleSideAllowed: true,
    weekOffBothSideAllowed: false,
    holidaySingleSideAllowed: true,
    holidayBothSideAllowed: false,
    maxConsecutiveDays: 15,
    maxPendingRequests: 2,
    status: LeaveDefinitionStatus.ACTIVE,
    sortOrder: 6,
    blockedCodes: [],
  },
] as const

const leaveGroupSeeds = [
  {
    code: "DEFAULT_ALL",
    name: "Default Staff Leave Group",
    description: "Baseline leave policy for all active staff.",
    assignmentMode: LeaveGroupAssignmentMode.ALL_STAFF,
    status: LeaveGroupStatus.ACTIVE,
    sortOrder: 1,
    leaveCodes: ["PAID", "UNPAID", "RESTRICTED", "COMP", "TOD"],
    staffCount: 0,
  },
  {
    code: "FIELD_TEAM",
    name: "Field Team Leave Group",
    description: "Leave policy for selected field staff members.",
    assignmentMode: LeaveGroupAssignmentMode.SELECTED_STAFF,
    status: LeaveGroupStatus.ACTIVE,
    sortOrder: 2,
    leaveCodes: ["LAYOFF", "UNPAID", "TOD"],
    staffCount: 2,
  },
] as const

const DEFAULT_TENANT_ID = "tenant_default"

const ensureAuthorized = async () => {
  const session = await auth()
  const role = (session?.user as { role?: Role })?.role
  if (!session?.user || !canManageUsers(role ?? null)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  return null
}

const seedTaxes = async () => {
  const taxes = [
    { name: "GST 18%", percent: 18, sortOrder: 1 },
    { name: "VAT 5%", percent: 5, sortOrder: 2 },
  ]
  const created: string[] = []
  for (const tax of taxes) {
    const row = await prisma.tax.upsert({
      where: { tenantId_name: { tenantId: DEFAULT_TENANT_ID, name: tax.name } },
      update: {
        percent: tax.percent,
        isActive: true,
        sortOrder: tax.sortOrder,
      },
      create: {
        tenantId: DEFAULT_TENANT_ID,
        name: tax.name,
        percent: tax.percent,
        isActive: true,
        sortOrder: tax.sortOrder,
      },
    })
    created.push(row.id)
  }
  return { count: created.length }
}

const seedUsers = async () => {
  const passwordHash = await bcrypt.hash("password123", 10)
  let touched = 0
  const managerIds: string[] = []
  const staffUserIds: string[] = []
  for (const user of seededUsers) {
    const row = await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        role: user.role,
        status: UserStatus.ACTIVE,
        passwordHash,
      },
      create: {
        name: user.name,
        email: user.email,
        role: user.role,
        status: UserStatus.ACTIVE,
        passwordHash,
      },
    })
    touched += 1
    if (row.role === Role.MANAGER) managerIds.push(row.id)
    if (row.role === Role.STAFF) staffUserIds.push(row.id)
  }

  for (const [index, staffUserId] of staffUserIds.entries()) {
    const managerUserId =
      managerIds.length > 0 ? managerIds[index % managerIds.length] : null
    await prisma.staffProfile.upsert({
      where: { userId: staffUserId },
      update: { managerUserId },
      create: { userId: staffUserId, managerUserId },
    })
  }
  return { count: touched }
}

const seedServiceCatalog = async () => {
  const categoryByName = new Map<string, string>()
  for (const item of serviceCategorySeeds) {
    const category = await prisma.serviceCategory.upsert({
      where: { tenantId_name: { tenantId: DEFAULT_TENANT_ID, name: item.name } },
      update: {
        description: item.description,
        status: "ACTIVE",
      },
      create: {
        tenantId: DEFAULT_TENANT_ID,
        name: item.name,
        description: item.description,
        status: "ACTIVE",
      },
    })
    categoryByName.set(item.name, category.id)
  }

  const taxByName = new Map(
    (
      await prisma.tax.findMany({
        where: { tenantId: DEFAULT_TENANT_ID, name: { in: ["GST 18%", "VAT 5%"] } },
        select: { id: true, name: true },
      })
    ).map((tax) => [tax.name, tax.id])
  )

  let touched = 0
  const seededServiceIds: string[] = []
  const serviceIdByName = new Map<string, string>()
  for (const item of serviceSeeds) {
    const categoryId = categoryByName.get(item.categoryName)
    if (!categoryId) continue
    const existing = await prisma.service.findFirst({ where: { name: item.name } })
    const service = existing
      ? await prisma.service.update({
          where: { id: existing.id },
          data: {
            description: item.description,
            durationMinutes: item.durationMinutes,
            priceCents: item.priceCents,
            tenantId: DEFAULT_TENANT_ID,
            categoryId,
            status: "ACTIVE",
            type: item.type,
            taxMode: "EXCLUSIVE",
          },
        })
      : await prisma.service.create({
          data: {
            tenantId: DEFAULT_TENANT_ID,
            name: item.name,
            description: item.description,
            durationMinutes: item.durationMinutes,
            priceCents: item.priceCents,
            categoryId,
            status: "ACTIVE",
            type: item.type,
            taxMode: "EXCLUSIVE",
          },
        })

    const nextTaxIds = item.taxNames
      .map((name) => taxByName.get(name))
      .filter((id): id is string => Boolean(id))
    await prisma.serviceTax.deleteMany({ where: { serviceId: service.id } })
    if (nextTaxIds.length > 0) {
      await prisma.serviceTax.createMany({
        data: nextTaxIds.map((taxId) => ({
          serviceId: service.id,
          taxId,
        })),
      })
    }
    seededServiceIds.push(service.id)
    serviceIdByName.set(item.name, service.id)
    touched += 1
  }

  for (const item of serviceSeeds) {
    if (item.type !== ServiceType.PACKAGE) continue
    const packageId = serviceIdByName.get(item.name)
    if (!packageId) continue
    await prisma.servicePackageItem.deleteMany({ where: { packageId } })
    const packageItemNames = "packageItemNames" in item ? (item.packageItemNames ?? []) : []
    const packageItems = packageItemNames
      .map((itemName, index) => ({
        itemServiceId: serviceIdByName.get(itemName),
        sortOrder: index,
      }))
      .filter((entry): entry is { itemServiceId: string; sortOrder: number } => Boolean(entry.itemServiceId))
    if (packageItems.length > 0) {
      await prisma.servicePackageItem.createMany({
        data: packageItems.map((entry) => ({
          packageId,
          itemServiceId: entry.itemServiceId,
          sortOrder: entry.sortOrder,
        })),
      })
    }
  }

  const staffUsers = await prisma.user.findMany({
    where: {
      role: Role.STAFF,
      email: { in: seededUsers.filter((user) => user.role === Role.STAFF).map((user) => user.email) },
    },
    select: { id: true },
  })

  if (staffUsers.length > 0 && seededServiceIds.length > 0) {
    await prisma.staffServiceEligibility.deleteMany({
      where: {
        userId: { in: staffUsers.map((user) => user.id) },
        serviceId: { in: seededServiceIds },
      },
    })
    await prisma.staffServiceEligibility.createMany({
      data: staffUsers.flatMap((user) =>
        seededServiceIds.map((serviceId) => ({
          userId: user.id,
          serviceId,
        }))
      ),
      skipDuplicates: true,
    })
  }

  return { count: touched }
}

const seedInventoryCatalog = async () => {
  const categoryByName = new Map<string, string>()
  for (const item of inventoryCategorySeeds) {
    const category = await prisma.inventoryCategory.upsert({
      where: { tenantId_name: { tenantId: DEFAULT_TENANT_ID, name: item.name } },
      update: {
        description: item.description,
        status: InventoryCategoryStatus.ACTIVE,
      },
      create: {
        tenantId: DEFAULT_TENANT_ID,
        name: item.name,
        description: item.description,
        status: InventoryCategoryStatus.ACTIVE,
      },
    })
    categoryByName.set(item.name, category.id)
  }

  const supplierByName = new Map<string, string>()
  for (const item of supplierSeeds) {
    const existing = await prisma.supplier.findFirst({
      where: { tenantId: DEFAULT_TENANT_ID, name: item.name },
    })
    const supplier = existing
      ? await prisma.supplier.update({
          where: { id: existing.id },
          data: {
            email: item.email,
            phone: item.phone,
            status: SupplierStatus.ACTIVE,
          },
        })
      : await prisma.supplier.create({
          data: {
            tenantId: DEFAULT_TENANT_ID,
            name: item.name,
            email: item.email,
            phone: item.phone,
            status: SupplierStatus.ACTIVE,
          },
        })
    supplierByName.set(item.name, supplier.id)
  }

  const taxByName = new Map(
    (
      await prisma.tax.findMany({
        where: { tenantId: DEFAULT_TENANT_ID, name: { in: ["GST 18%", "VAT 5%"] } },
        select: { id: true, name: true },
      })
    ).map((tax) => [tax.name, tax.id])
  )

  let touched = 0
  for (const item of productSeeds) {
    const categoryId = categoryByName.get(item.categoryName)
    const supplierId = supplierByName.get(item.supplierName)
    if (!categoryId || !supplierId) continue
    const product = await prisma.inventoryProduct.upsert({
      where: { tenantId_sku: { tenantId: DEFAULT_TENANT_ID, sku: item.sku } },
      update: {
        tenantId: DEFAULT_TENANT_ID,
        name: item.name,
        categoryId,
        status: InventoryProductStatus.ACTIVE,
        costPriceCents: item.costPriceCents,
        mrpCents: item.mrpCents,
        reorderPoint: item.reorderPoint,
        reorderQty: item.reorderQty,
        onHandQty: item.initialQty,
      },
      create: {
        tenantId: DEFAULT_TENANT_ID,
        sku: item.sku,
        name: item.name,
        categoryId,
        status: InventoryProductStatus.ACTIVE,
        costPriceCents: item.costPriceCents,
        mrpCents: item.mrpCents,
        reorderPoint: item.reorderPoint,
        reorderQty: item.reorderQty,
        onHandQty: item.initialQty,
      },
    })

    await prisma.inventoryProductSupplier.upsert({
      where: { productId_supplierId: { productId: product.id, supplierId } },
      update: {
        supplierCostCents: item.costPriceCents,
        isPreferred: true,
      },
      create: {
        productId: product.id,
        supplierId,
        supplierCostCents: item.costPriceCents,
        isPreferred: true,
      },
    })

    const taxIds = item.taxNames
      .map((name) => taxByName.get(name))
      .filter((id): id is string => Boolean(id))
    await prisma.inventoryProductTax.deleteMany({ where: { productId: product.id } })
    if (taxIds.length > 0) {
      await prisma.inventoryProductTax.createMany({
        data: taxIds.map((taxId) => ({ productId: product.id, taxId })),
      })
    }
    touched += 1
  }
  return { count: touched }
}

const seedPurchases = async () => {
  const supplier = await prisma.supplier.findFirst({
    where: { tenantId: DEFAULT_TENANT_ID, name: supplierSeeds[0].name },
  })
  if (!supplier) {
    throw new Error("Supplier seeds are missing. Seed inventory catalog first.")
  }

  const products = await prisma.inventoryProduct.findMany({
    where: {
      tenantId: DEFAULT_TENANT_ID,
      sku: { in: [productSeeds[0].sku, productSeeds[1].sku] },
    },
    select: { id: true, sku: true },
  })
  if (products.length < 2) {
    throw new Error("Product seeds are missing. Seed inventory catalog first.")
  }
  const bySku = new Map(products.map((product) => [product.sku, product.id]))

  const orderNumber = "SEED-PO-001"
  const existing = await prisma.purchaseOrder.findUnique({
    where: { tenantId_orderNumber: { tenantId: DEFAULT_TENANT_ID, orderNumber } },
    select: { id: true },
  })
  if (existing) {
    return { count: 1 }
  }

  const lineInputs = [
    { sku: productSeeds[0].sku, quantity: 20, unitCostCents: 900, taxPercent: 5 },
    { sku: productSeeds[1].sku, quantity: 15, unitCostCents: 700, taxPercent: 5 },
  ]
  const lines = lineInputs.flatMap((line) => {
    const productId = bySku.get(line.sku)
    if (!productId) return []
    const lineSubtotalCents = line.quantity * line.unitCostCents
    const lineTaxCents = Math.round((lineSubtotalCents * line.taxPercent) / 100)
    return [{
      productId,
      quantity: line.quantity,
      receivedQty: line.quantity,
      unitCostCents: line.unitCostCents,
      taxPercent: line.taxPercent,
      lineSubtotalCents,
      lineTaxCents,
      lineTotalCents: lineSubtotalCents + lineTaxCents,
    }]
  })
  const subtotalCents = lines.reduce((sum, line) => sum + line.lineSubtotalCents, 0)
  const taxCents = lines.reduce((sum, line) => sum + line.lineTaxCents, 0)

  const order = await prisma.purchaseOrder.create({
    data: {
      tenantId: DEFAULT_TENANT_ID,
      orderNumber,
      supplierId: supplier.id,
      status: PurchaseOrderStatus.RECEIVED,
      orderDate: new Date(),
      expectedDate: new Date(),
      receivedAt: new Date(),
      subtotalCents,
      taxCents,
      totalCents: subtotalCents + taxCents,
      items: { create: lines },
    },
    include: { items: true },
  })

  await prisma.$transaction(async (tx) => {
    for (const item of order.items) {
      await tx.inventoryProduct.update({
        where: { id: item.productId },
        data: { onHandQty: { increment: item.receivedQty } },
      })
      await tx.inventoryStockMovement.create({
        data: {
          tenantId: DEFAULT_TENANT_ID,
          productId: item.productId,
          orderItemId: item.id,
          type: "PURCHASE_RECEIPT",
          quantityDelta: item.receivedQty,
          unitCostCents: item.unitCostCents,
          note: `Seed purchase ${order.orderNumber}`,
        },
      })
    }
  })

  return { count: 1 }
}

const seedCoupons = async () => {
  let touched = 0
  for (const item of couponSeeds) {
    await prisma.coupon.upsert({
      where: { tenantId_code: { tenantId: DEFAULT_TENANT_ID, code: item.code } },
      update: {
        name: item.name,
        discountType: item.discountType,
        discountValue: item.discountValue,
        appliesTo: item.appliesTo,
        isActive: true,
      },
      create: {
        tenantId: DEFAULT_TENANT_ID,
        code: item.code,
        name: item.name,
        discountType: item.discountType,
        discountValue: item.discountValue,
        appliesTo: item.appliesTo,
        isActive: true,
      },
    })
    touched += 1
  }
  return { count: touched }
}

const toDateOnlyUtc = (value: Date) =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))

const buildSeedDateTime = (daysFromToday: number, hour: number, minute: number) => {
  const now = new Date()
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + daysFromToday,
      hour,
      minute,
      0,
      0
    )
  )
}

const seedAppointments = async () => {
  const customers = await prisma.user.findMany({
    where: {
      role: Role.CUSTOMER,
      email: { in: seededUsers.filter((user) => user.role === Role.CUSTOMER).map((user) => user.email) },
    },
    orderBy: { email: "asc" },
    take: 5,
    select: { id: true },
  })
  const staffProfiles = await prisma.staffProfile.findMany({
    where: {
      user: {
        role: Role.STAFF,
        email: { in: seededUsers.filter((user) => user.role === Role.STAFF).map((user) => user.email) },
      },
    },
    orderBy: { user: { email: "asc" } },
    take: 5,
    select: { id: true },
  })
  const services = await prisma.service.findMany({
    where: {
      type: ServiceType.STANDARD,
      name: { in: serviceSeeds.map((service) => service.name) },
    },
    orderBy: { name: "asc" },
    take: 3,
    select: {
      id: true,
      durationMinutes: true,
      priceCents: true,
      taxMode: true,
      defaultTaxes: {
        select: {
          tax: {
            select: {
              id: true,
              name: true,
              percent: true,
            },
          },
        },
      },
    },
  })
  if (!customers.length || !staffProfiles.length || !services.length) {
    throw new Error("User and service seeds are required before seeding appointments.")
  }

  const totalAppointments = 60
  const pastAppointments = 12
  const scenarios = Array.from({ length: totalAppointments }, (_, index) => {
    const isPast = index < pastAppointments
    const daysFromToday = isPast
      ? -1 - (index % 7)
      : 1 + Math.floor((index - pastAppointments) / 2)
    return {
      marker: `SEED_APPT_V2_${String(index + 1).padStart(3, "0")}`,
      daysFromToday,
      hour: 9 + (index % 8),
      minute: (index % 2) * 30,
      status: isPast ? AppointmentOrderStatus.COMPLETED : AppointmentOrderStatus.CONFIRMED,
      appointmentStatus: isPast ? AppointmentStatus.COMPLETED : AppointmentStatus.SCHEDULED,
    }
  })

  let created = 0
  for (let index = 0; index < scenarios.length; index += 1) {
    const scenario = scenarios[index]
    const exists = await prisma.appointmentOrder.findFirst({
      where: { internalNote: scenario.marker },
      select: { id: true },
    })
    if (exists) continue

    const customerId = customers[index % customers.length].id
    const staffProfileId = staffProfiles[index % staffProfiles.length].id
    const service = services[index % services.length]
    const startAt = buildSeedDateTime(scenario.daysFromToday, scenario.hour, scenario.minute)
    const endAt = new Date(startAt.getTime() + service.durationMinutes * 60000)
    const appointmentDate = toDateOnlyUtc(startAt)
    const subtotalCents = service.priceCents
    const lineTaxEntries = service.defaultTaxes
      .map((entry) => entry.tax)
      .map((tax) => ({
        taxId: tax.id,
        name: tax.name,
        percent: tax.percent,
        taxCents: Math.max(0, Math.round((subtotalCents * tax.percent) / 100)),
      }))
    const lineTaxCents = lineTaxEntries.reduce((sum, entry) => sum + entry.taxCents, 0)
    const lineTotalCents = subtotalCents + lineTaxCents

    await prisma.$transaction(async (tx) => {
      const order = await tx.appointmentOrder.create({
        data: {
          customerId,
          appointmentDate,
          appointmentStartAt: startAt,
          status: scenario.status,
          internalNote: scenario.marker,
          subtotalCents,
          lineDiscountCents: 0,
          couponDiscountCents: 0,
          taxCents: lineTaxCents,
          totalCents: lineTotalCents,
          taxes: {
            create: lineTaxEntries.map((entry) => ({
              taxId: entry.taxId,
              name: entry.name,
              percent: entry.percent,
              taxCents: entry.taxCents,
            })),
          },
          lines: {
            create: [{
              serviceId: service.id,
              staffProfileId,
              sortOrder: 0,
              quantity: 1,
              durationMinutes: service.durationMinutes,
              unitPriceCents: service.priceCents,
              discountType: "NONE",
              discountValue: 0,
              taxMode: service.taxMode,
              taxIds: lineTaxEntries.map((entry) => entry.taxId),
              lineSubtotalCents: subtotalCents,
              lineDiscountCents: 0,
              lineTaxCents,
              lineTotalCents,
              startAt,
              endAt,
              note: "Seeded appointment",
            }],
          },
        },
        include: { lines: true },
      })

      const line = order.lines[0]
      await tx.appointment.create({
        data: {
          customerId,
          staffProfileId,
          serviceId: service.id,
          orderLineId: line.id,
          startAt,
          endAt,
          status: scenario.appointmentStatus,
        },
      })
    })

    created += 1
  }

  return { count: created }
}

const seedShifts = async () => {
  const templateByName = new Map<string, string>()
  for (const item of shiftTemplateSeeds) {
    const existing = await prisma.shiftTemplate.findFirst({
      where: { name: item.name },
      select: { id: true },
    })
    const template = existing
      ? await prisma.shiftTemplate.update({
          where: { id: existing.id },
          data: {
            description: item.description,
            color: item.color,
            isActive: true,
            startTime: item.startTime,
            endTime: item.endTime,
            breaks: {
              deleteMany: {},
              create: item.breaks,
            },
          },
        })
      : await prisma.shiftTemplate.create({
          data: {
            name: item.name,
            description: item.description,
            color: item.color,
            isActive: true,
            startTime: item.startTime,
            endTime: item.endTime,
            breaks: { create: item.breaks },
          },
        })
    templateByName.set(item.name, template.id)
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const offsetToMonday = (today.getDay() + 6) % 7
  const startDate = new Date(today)
  startDate.setDate(today.getDate() - offsetToMonday)
  const morningTemplateId = templateByName.get("Morning Shift")
  const eveningTemplateId = templateByName.get("Evening Shift")
  if (!morningTemplateId || !eveningTemplateId) {
    throw new Error("Unable to seed shift templates.")
  }

  const upsertScheduleByName = async (
    name: string,
    options: {
      isDefault: boolean
      weekOffDay1: Weekday
      blocks: Array<{ templateId: string; repeatDays: number; sortOrder: number }>
    }
  ) => {
    const existing = await prisma.shiftSchedule.findFirst({
      where: { name, isDefault: options.isDefault },
      select: { id: true },
    })
    if (options.isDefault) {
      await prisma.shiftSchedule.updateMany({ data: { isDefault: false } })
    }
    if (existing) {
      return prisma.shiftSchedule.update({
        where: { id: existing.id },
        data: {
          isDefault: options.isDefault,
          startDate,
          weekOffDay1: options.weekOffDay1,
          weekOffDay2: null,
          weekOff2Weeks: [],
          blocks: {
            deleteMany: {},
            create: options.blocks,
          },
        },
      })
    }
    return prisma.shiftSchedule.create({
      data: {
        name,
        isDefault: options.isDefault,
        startDate,
        weekOffDay1: options.weekOffDay1,
        weekOffDay2: null,
        weekOff2Weeks: [],
        blocks: { create: options.blocks },
      },
    })
  }

  await upsertScheduleByName("Seed Default Schedule", {
    isDefault: true,
    weekOffDay1: Weekday.SUNDAY,
    blocks: [
      { templateId: morningTemplateId, repeatDays: 5, sortOrder: 0 },
      { templateId: eveningTemplateId, repeatDays: 2, sortOrder: 1 },
    ],
  })

  const staffProfiles = await prisma.staffProfile.findMany({
    where: {
      user: {
        role: Role.STAFF,
        email: { in: seededUsers.filter((user) => user.role === Role.STAFF).map((user) => user.email) },
      },
    },
    select: { id: true },
    take: 5,
  })
  if (staffProfiles.length > 0) {
    const existing = await prisma.shiftSchedule.findFirst({
      where: { name: "Seed Staff Schedule", isDefault: false },
      select: { id: true },
    })
    if (existing) {
      await prisma.shiftSchedule.update({
        where: { id: existing.id },
        data: {
          startDate,
          weekOffDay1: Weekday.SUNDAY,
          weekOffDay2: Weekday.SATURDAY,
          weekOff2Weeks: [1, 2, 3, 4, 5],
          blocks: {
            deleteMany: {},
            create: [{ templateId: morningTemplateId, repeatDays: 7, sortOrder: 0 }],
          },
          assignments: {
            deleteMany: {},
            create: staffProfiles.map((profile) => ({
              staffProfileId: profile.id,
              startDate,
              endDate: null,
            })),
          },
        },
      })
    } else {
      await prisma.shiftSchedule.create({
        data: {
          name: "Seed Staff Schedule",
          isDefault: false,
          startDate,
          weekOffDay1: Weekday.SUNDAY,
          weekOffDay2: Weekday.SATURDAY,
          weekOff2Weeks: [1, 2, 3, 4, 5],
          blocks: {
            create: [{ templateId: morningTemplateId, repeatDays: 7, sortOrder: 0 }],
          },
          assignments: {
            create: staffProfiles.map((profile) => ({
              staffProfileId: profile.id,
              startDate,
              endDate: null,
            })),
          },
        },
      })
    }
  }

  return { count: shiftTemplateSeeds.length + 2 }
}

const seedLeaves = async () => {
  const definitionIdByCode = new Map<string, string>()
  for (const item of leaveDefinitionSeeds) {
    const row = await prisma.leaveDefinition.upsert({
      where: { tenantId_code: { tenantId: DEFAULT_TENANT_ID, code: item.code } },
      update: {
        name: item.name,
        leaveType: item.leaveType,
        allowedUsers: item.allowedUsers,
        minDaysPerRequest: item.minDaysPerRequest,
        maxDaysPerRequest: item.maxDaysPerRequest,
        allowWithOtherLeaves: item.allowWithOtherLeaves,
        priorEntryAllowed: item.priorEntryAllowed,
        noticeDays: item.noticeDays,
        allowCarryForward: item.allowCarryForward,
        weekOffSingleSideAllowed: item.weekOffSingleSideAllowed,
        weekOffBothSideAllowed: item.weekOffBothSideAllowed,
        holidaySingleSideAllowed: item.holidaySingleSideAllowed,
        holidayBothSideAllowed: item.holidayBothSideAllowed,
        maxConsecutiveDays: item.maxConsecutiveDays,
        maxPendingRequests: item.maxPendingRequests,
        status: item.status,
        sortOrder: item.sortOrder,
      },
      create: {
        tenantId: DEFAULT_TENANT_ID,
        code: item.code,
        name: item.name,
        leaveType: item.leaveType,
        allowedUsers: item.allowedUsers,
        minDaysPerRequest: item.minDaysPerRequest,
        maxDaysPerRequest: item.maxDaysPerRequest,
        allowWithOtherLeaves: item.allowWithOtherLeaves,
        priorEntryAllowed: item.priorEntryAllowed,
        noticeDays: item.noticeDays,
        allowCarryForward: item.allowCarryForward,
        weekOffSingleSideAllowed: item.weekOffSingleSideAllowed,
        weekOffBothSideAllowed: item.weekOffBothSideAllowed,
        holidaySingleSideAllowed: item.holidaySingleSideAllowed,
        holidayBothSideAllowed: item.holidayBothSideAllowed,
        maxConsecutiveDays: item.maxConsecutiveDays,
        maxPendingRequests: item.maxPendingRequests,
        status: item.status,
        sortOrder: item.sortOrder,
      },
    })
    definitionIdByCode.set(item.code, row.id)
  }

  const definitionIds = Array.from(definitionIdByCode.values())
  if (definitionIds.length > 0) {
    await prisma.leaveDefinitionNonClubbable.deleteMany({
      where: { leaveDefinitionId: { in: definitionIds } },
    })
    const nonClubbables = leaveDefinitionSeeds.flatMap((item) =>
      item.blockedCodes
        .map((code) => {
          const leaveDefinitionId = definitionIdByCode.get(item.code)
          const blockedLeaveId = definitionIdByCode.get(code)
          if (!leaveDefinitionId || !blockedLeaveId) return null
          return { leaveDefinitionId, blockedLeaveId }
        })
        .filter(
          (entry): entry is { leaveDefinitionId: string; blockedLeaveId: string } =>
            Boolean(entry)
        )
    )
    if (nonClubbables.length > 0) {
      await prisma.leaveDefinitionNonClubbable.createMany({
        data: nonClubbables,
        skipDuplicates: true,
      })
    }
  }

  const staffProfiles = await prisma.staffProfile.findMany({
    where: {
      user: {
        tenantId: DEFAULT_TENANT_ID,
        role: Role.STAFF,
        email: { in: seededUsers.filter((user) => user.role === Role.STAFF).map((user) => user.email) },
      },
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  })

  for (const group of leaveGroupSeeds) {
    const leaveDefinitionIds = group.leaveCodes
      .map((code) => definitionIdByCode.get(code))
      .filter((id): id is string => Boolean(id))
    const staffProfileIds =
      group.assignmentMode === LeaveGroupAssignmentMode.SELECTED_STAFF
        ? staffProfiles.slice(0, group.staffCount).map((item) => item.id)
        : []

    await prisma.leaveGroup.upsert({
      where: { tenantId_code: { tenantId: DEFAULT_TENANT_ID, code: group.code } },
      update: {
        name: group.name,
        description: group.description,
        assignmentMode: group.assignmentMode,
        status: group.status,
        sortOrder: group.sortOrder,
        leaves: {
          deleteMany: {},
          create: leaveDefinitionIds.map((leaveDefinitionId) => ({
            leaveDefinitionId,
          })),
        },
        staffAssignments: {
          deleteMany: {},
          create: staffProfileIds.map((staffProfileId) => ({
            staffProfileId,
          })),
        },
      },
      create: {
        tenantId: DEFAULT_TENANT_ID,
        code: group.code,
        name: group.name,
        description: group.description,
        assignmentMode: group.assignmentMode,
        status: group.status,
        sortOrder: group.sortOrder,
        leaves: {
          create: leaveDefinitionIds.map((leaveDefinitionId) => ({
            leaveDefinitionId,
          })),
        },
        staffAssignments: {
          create: staffProfileIds.map((staffProfileId) => ({
            staffProfileId,
          })),
        },
      },
    })
  }

  return { count: leaveDefinitionSeeds.length + leaveGroupSeeds.length }
}

const clearData = async () => {
  const adminUsers = await prisma.user.findMany({
    where: { role: Role.ADMIN },
    select: { id: true, email: true },
  })
  const adminIds = new Set(adminUsers.map((user) => user.id))
  const nonAdminUsers = await prisma.user.findMany({
    where: { role: { not: Role.ADMIN } },
    select: { id: true },
  })
  const nonAdminIds = nonAdminUsers.map((user) => user.id)

  const result = await prisma.$transaction(async (tx) => {
    const counts: Record<string, number> = {}

    counts.appointments = (await tx.appointment.deleteMany({})).count
    counts.appointmentOrders = (await tx.appointmentOrder.deleteMany({})).count
    counts.coupons = (await tx.coupon.deleteMany({})).count

    counts.inventoryStockMovements = (await tx.inventoryStockMovement.deleteMany({})).count
    counts.purchaseOrders = (await tx.purchaseOrder.deleteMany({})).count
    counts.inventoryProductSuppliers = (await tx.inventoryProductSupplier.deleteMany({})).count
    counts.inventoryProductTaxes = (await tx.inventoryProductTax.deleteMany({})).count
    counts.inventoryProducts = (await tx.inventoryProduct.deleteMany({})).count
    counts.suppliers = (await tx.supplier.deleteMany({})).count
    counts.inventoryCategories = (await tx.inventoryCategory.deleteMany({})).count

    counts.staffRosterHistoryDays = (await tx.staffRosterHistoryDay.deleteMany({})).count
    counts.staffShiftOverrides = (await tx.staffShiftOverride.deleteMany({})).count
    counts.staffScheduleAssignments = (await tx.staffScheduleAssignment.deleteMany({})).count
    counts.shiftScheduleBlocks = (await tx.shiftScheduleBlock.deleteMany({})).count
    counts.shiftSchedules = (await tx.shiftSchedule.deleteMany({})).count
    counts.shiftTemplateBreaks = (await tx.shiftTemplateBreak.deleteMany({})).count
    counts.shiftTemplates = (await tx.shiftTemplate.deleteMany({})).count

    counts.staffServiceEligibility = (await tx.staffServiceEligibility.deleteMany({})).count
    counts.serviceTaxes = (await tx.serviceTax.deleteMany({})).count
    counts.servicePackageItems = (await tx.servicePackageItem.deleteMany({})).count
    counts.services = (await tx.service.deleteMany({})).count
    counts.serviceCategories = (await tx.serviceCategory.deleteMany({})).count
    counts.taxes = (await tx.tax.deleteMany({})).count

    counts.staffCertifications = (await tx.staffCertification.deleteMany({})).count
    counts.staffDocuments = (await tx.staffDocument.deleteMany({})).count
    counts.invitations = (await tx.invitation.deleteMany({})).count
    counts.passwordResetTokens = (await tx.passwordResetToken.deleteMany({})).count
    counts.verificationTokens = (await tx.verificationToken.deleteMany({})).count
    if (nonAdminIds.length > 0) {
      counts.sessions = (await tx.session.deleteMany({ where: { userId: { in: nonAdminIds } } })).count
      counts.accounts = (await tx.account.deleteMany({ where: { userId: { in: nonAdminIds } } })).count
      counts.staffProfiles = (await tx.staffProfile.deleteMany({ where: { userId: { in: nonAdminIds } } })).count
      counts.users = (await tx.user.deleteMany({ where: { id: { in: nonAdminIds } } })).count
    } else {
      counts.sessions = 0
      counts.accounts = 0
      counts.staffProfiles = 0
      counts.users = 0
    }

    return counts
  })

  return {
    deleted: result,
    preservedAdmins: adminUsers.filter((user) => adminIds.has(user.id)).map((user) => user.email),
  }
}

const previewClearData = async () => {
  const adminUsers = await prisma.user.findMany({
    where: { role: Role.ADMIN },
    select: { id: true, email: true },
  })
  const nonAdminIds = (
    await prisma.user.findMany({
      where: { role: { not: Role.ADMIN } },
      select: { id: true },
    })
  ).map((user) => user.id)

  const [
    appointments,
    appointmentOrders,
    coupons,
    inventoryStockMovements,
    purchaseOrders,
    inventoryProductSuppliers,
    inventoryProductTaxes,
    inventoryProducts,
    suppliers,
    inventoryCategories,
    staffRosterHistoryDays,
    staffShiftOverrides,
    staffScheduleAssignments,
    shiftScheduleBlocks,
    shiftSchedules,
    shiftTemplateBreaks,
    shiftTemplates,
    staffServiceEligibility,
    serviceTaxes,
    servicePackageItems,
    services,
    serviceCategories,
    taxes,
    staffCertifications,
    staffDocuments,
    invitations,
    passwordResetTokens,
    verificationTokens,
    sessions,
    accounts,
    staffProfiles,
    users,
  ] = await Promise.all([
    prisma.appointment.count(),
    prisma.appointmentOrder.count(),
    prisma.coupon.count(),
    prisma.inventoryStockMovement.count(),
    prisma.purchaseOrder.count(),
    prisma.inventoryProductSupplier.count(),
    prisma.inventoryProductTax.count(),
    prisma.inventoryProduct.count(),
    prisma.supplier.count(),
    prisma.inventoryCategory.count(),
    prisma.staffRosterHistoryDay.count(),
    prisma.staffShiftOverride.count(),
    prisma.staffScheduleAssignment.count(),
    prisma.shiftScheduleBlock.count(),
    prisma.shiftSchedule.count(),
    prisma.shiftTemplateBreak.count(),
    prisma.shiftTemplate.count(),
    prisma.staffServiceEligibility.count(),
    prisma.serviceTax.count(),
    prisma.servicePackageItem.count(),
    prisma.service.count(),
    prisma.serviceCategory.count(),
    prisma.tax.count(),
    prisma.staffCertification.count(),
    prisma.staffDocument.count(),
    prisma.invitation.count(),
    prisma.passwordResetToken.count(),
    prisma.verificationToken.count(),
    nonAdminIds.length
      ? prisma.session.count({ where: { userId: { in: nonAdminIds } } })
      : Promise.resolve(0),
    nonAdminIds.length
      ? prisma.account.count({ where: { userId: { in: nonAdminIds } } })
      : Promise.resolve(0),
    nonAdminIds.length
      ? prisma.staffProfile.count({ where: { userId: { in: nonAdminIds } } })
      : Promise.resolve(0),
    nonAdminIds.length
      ? prisma.user.count({ where: { id: { in: nonAdminIds } } })
      : Promise.resolve(0),
  ])

  return {
    wouldDelete: {
      appointments,
      appointmentOrders,
      coupons,
      inventoryStockMovements,
      purchaseOrders,
      inventoryProductSuppliers,
      inventoryProductTaxes,
      inventoryProducts,
      suppliers,
      inventoryCategories,
      staffRosterHistoryDays,
      staffShiftOverrides,
      staffScheduleAssignments,
      shiftScheduleBlocks,
      shiftSchedules,
      shiftTemplateBreaks,
      shiftTemplates,
      staffServiceEligibility,
      serviceTaxes,
      servicePackageItems,
      services,
      serviceCategories,
      taxes,
      staffCertifications,
      staffDocuments,
      invitations,
      passwordResetTokens,
      verificationTokens,
      sessions,
      accounts,
      staffProfiles,
      users,
    },
    preservedAdmins: adminUsers.map((user) => user.email),
  }
}

const clearDependencyMap: Record<ClearModule, ClearModule[]> = {
  appointments: [],
  coupons: [],
  purchases: [],
  inventory: ["purchases", "appointments"],
  shifts: [],
  services: ["appointments"],
  taxes: ["services", "inventory"],
  users: ["appointments"],
}

const clearExecutionOrder: ClearModule[] = [
  "appointments",
  "coupons",
  "purchases",
  "inventory",
  "shifts",
  "services",
  "taxes",
  "users",
]

const expandClearModules = (selected: Set<ClearModule>, mode: ClearMode) => {
  const expanded = new Set<ClearModule>(selected)
  const missingByModule: Partial<Record<ClearModule, ClearModule[]>> = {}

  const visit = (moduleKey: ClearModule) => {
    for (const dependency of clearDependencyMap[moduleKey]) {
      if (!selected.has(dependency)) {
        if (!missingByModule[moduleKey]) missingByModule[moduleKey] = []
        missingByModule[moduleKey]!.push(dependency)
      }
      if (!expanded.has(dependency)) {
        expanded.add(dependency)
        visit(dependency)
      }
    }
  }

  for (const moduleKey of selected) {
    visit(moduleKey)
  }

  const hasMissing = Object.keys(missingByModule).length > 0
  if (mode === "strict" && hasMissing) {
    return {
      ok: false as const,
      missingByModule,
      expanded: Array.from(expanded),
    }
  }

  return {
    ok: true as const,
    missingByModule,
    expanded: Array.from(expanded),
  }
}

const countModuleData = async (modules: Set<ClearModule>) => {
  const nonAdminIds = modules.has("users")
    ? (
        await prisma.user.findMany({
          where: { role: { not: Role.ADMIN } },
          select: { id: true },
        })
      ).map((user) => user.id)
    : []

  const counts: Record<string, number> = {}
  if (modules.has("appointments")) {
    counts.appointments = await prisma.appointment.count()
    counts.appointmentOrders = await prisma.appointmentOrder.count()
  }
  if (modules.has("coupons")) {
    counts.coupons = await prisma.coupon.count()
  }
  if (modules.has("purchases")) {
    counts.inventoryStockMovements = await prisma.inventoryStockMovement.count()
    counts.purchaseOrders = await prisma.purchaseOrder.count()
  }
  if (modules.has("inventory")) {
    counts.inventoryProductSuppliers = await prisma.inventoryProductSupplier.count()
    counts.inventoryProductTaxes = await prisma.inventoryProductTax.count()
    counts.inventoryProducts = await prisma.inventoryProduct.count()
    counts.suppliers = await prisma.supplier.count()
    counts.inventoryCategories = await prisma.inventoryCategory.count()
  }
  if (modules.has("shifts")) {
    counts.staffRosterHistoryDays = await prisma.staffRosterHistoryDay.count()
    counts.staffShiftOverrides = await prisma.staffShiftOverride.count()
    counts.staffScheduleAssignments = await prisma.staffScheduleAssignment.count()
    counts.shiftScheduleBlocks = await prisma.shiftScheduleBlock.count()
    counts.shiftSchedules = await prisma.shiftSchedule.count()
    counts.shiftTemplateBreaks = await prisma.shiftTemplateBreak.count()
    counts.shiftTemplates = await prisma.shiftTemplate.count()
  }
  if (modules.has("services")) {
    counts.staffServiceEligibility = await prisma.staffServiceEligibility.count()
    counts.serviceTaxes = await prisma.serviceTax.count()
    counts.servicePackageItems = await prisma.servicePackageItem.count()
    counts.services = await prisma.service.count()
    counts.serviceCategories = await prisma.serviceCategory.count()
  }
  if (modules.has("taxes")) {
    counts.taxes = await prisma.tax.count()
  }
  if (modules.has("users")) {
    counts.staffCertifications = await prisma.staffCertification.count()
    counts.staffDocuments = await prisma.staffDocument.count()
    counts.invitations = await prisma.invitation.count()
    counts.passwordResetTokens = await prisma.passwordResetToken.count()
    counts.verificationTokens = await prisma.verificationToken.count()
    counts.sessions = nonAdminIds.length
      ? await prisma.session.count({ where: { userId: { in: nonAdminIds } } })
      : 0
    counts.accounts = nonAdminIds.length
      ? await prisma.account.count({ where: { userId: { in: nonAdminIds } } })
      : 0
    counts.staffProfiles = nonAdminIds.length
      ? await prisma.staffProfile.count({ where: { userId: { in: nonAdminIds } } })
      : 0
    counts.users = nonAdminIds.length
      ? await prisma.user.count({ where: { id: { in: nonAdminIds } } })
      : 0
  }

  const preservedAdmins = (
    await prisma.user.findMany({
      where: { role: Role.ADMIN },
      select: { email: true },
    })
  ).map((user) => user.email)

  return { counts, preservedAdmins }
}

const clearModulesData = async (modules: Set<ClearModule>) => {
  const nonAdminIds = modules.has("users")
    ? (
        await prisma.user.findMany({
          where: { role: { not: Role.ADMIN } },
          select: { id: true },
        })
      ).map((user) => user.id)
    : []

  const deleted = await prisma.$transaction(async (tx) => {
    const counts: Record<string, number> = {}

    const has = (moduleKey: ClearModule) => modules.has(moduleKey)
    for (const moduleKey of clearExecutionOrder) {
      if (!has(moduleKey)) continue
      if (moduleKey === "appointments") {
        counts.appointments = (await tx.appointment.deleteMany({})).count
        counts.appointmentOrders = (await tx.appointmentOrder.deleteMany({})).count
      } else if (moduleKey === "coupons") {
        counts.coupons = (await tx.coupon.deleteMany({})).count
      } else if (moduleKey === "purchases") {
        counts.inventoryStockMovements = (await tx.inventoryStockMovement.deleteMany({})).count
        counts.purchaseOrders = (await tx.purchaseOrder.deleteMany({})).count
      } else if (moduleKey === "inventory") {
        counts.inventoryProductSuppliers = (await tx.inventoryProductSupplier.deleteMany({})).count
        counts.inventoryProductTaxes = (await tx.inventoryProductTax.deleteMany({})).count
        counts.inventoryProducts = (await tx.inventoryProduct.deleteMany({})).count
        counts.suppliers = (await tx.supplier.deleteMany({})).count
        counts.inventoryCategories = (await tx.inventoryCategory.deleteMany({})).count
      } else if (moduleKey === "shifts") {
        counts.staffRosterHistoryDays = (await tx.staffRosterHistoryDay.deleteMany({})).count
        counts.staffShiftOverrides = (await tx.staffShiftOverride.deleteMany({})).count
        counts.staffScheduleAssignments = (await tx.staffScheduleAssignment.deleteMany({})).count
        counts.shiftScheduleBlocks = (await tx.shiftScheduleBlock.deleteMany({})).count
        counts.shiftSchedules = (await tx.shiftSchedule.deleteMany({})).count
        counts.shiftTemplateBreaks = (await tx.shiftTemplateBreak.deleteMany({})).count
        counts.shiftTemplates = (await tx.shiftTemplate.deleteMany({})).count
      } else if (moduleKey === "services") {
        counts.staffServiceEligibility = (await tx.staffServiceEligibility.deleteMany({})).count
        counts.serviceTaxes = (await tx.serviceTax.deleteMany({})).count
        counts.servicePackageItems = (await tx.servicePackageItem.deleteMany({})).count
        counts.services = (await tx.service.deleteMany({})).count
        counts.serviceCategories = (await tx.serviceCategory.deleteMany({})).count
      } else if (moduleKey === "taxes") {
        counts.taxes = (await tx.tax.deleteMany({})).count
      } else if (moduleKey === "users") {
        counts.staffCertifications = (await tx.staffCertification.deleteMany({})).count
        counts.staffDocuments = (await tx.staffDocument.deleteMany({})).count
        counts.invitations = (await tx.invitation.deleteMany({})).count
        counts.passwordResetTokens = (await tx.passwordResetToken.deleteMany({})).count
        counts.verificationTokens = (await tx.verificationToken.deleteMany({})).count
        counts.sessions = nonAdminIds.length
          ? (await tx.session.deleteMany({ where: { userId: { in: nonAdminIds } } })).count
          : 0
        counts.accounts = nonAdminIds.length
          ? (await tx.account.deleteMany({ where: { userId: { in: nonAdminIds } } })).count
          : 0
        counts.staffProfiles = nonAdminIds.length
          ? (await tx.staffProfile.deleteMany({ where: { userId: { in: nonAdminIds } } })).count
          : 0
        counts.users = nonAdminIds.length
          ? (await tx.user.deleteMany({ where: { id: { in: nonAdminIds } } })).count
          : 0
      }
    }

    return counts
  })

  const preservedAdmins = (
    await prisma.user.findMany({
      where: { role: Role.ADMIN },
      select: { email: true },
    })
  ).map((user) => user.email)

  return { deleted, preservedAdmins }
}

export async function POST(request: Request) {
  const logContext = createApiLogContext(request)
  logApiRequestStart(logContext, request)

  const unauthorized = await ensureAuthorized()
  if (unauthorized) {
    logApiRequestSuccess(logContext, unauthorized.status, { reason: "unauthorized" })
    return withRequestId(unauthorized, logContext.requestId)
  }

  try {
    const payload = await request.json().catch(() => null)
    const parsed = requestSchema.safeParse(payload)
    if (!parsed.success) {
      const response = NextResponse.json(
        { error: "Invalid input.", details: parsed.error.flatten() },
        { status: 400 }
      )
      logApiRequestSuccess(logContext, 400, { reason: "validation_failed" })
      return withRequestId(response, logContext.requestId)
    }

    if (parsed.data.action === "previewClear") {
      const preview = await previewClearData()
      const response = NextResponse.json({
        ok: true,
        action: "previewClear",
        preview,
        message: "Preview generated.",
      })
      logApiRequestSuccess(logContext, 200, { action: "previewClear" })
      return withRequestId(response, logContext.requestId)
    }

    if (parsed.data.action === "previewModulesClear") {
      const mode: ClearMode = parsed.data.mode ?? "include_dependents"
      const selected = new Set<ClearModule>(parsed.data.modules ?? [])
      if (selected.size === 0) {
        const response = NextResponse.json({ error: "Select at least one module." }, { status: 400 })
        logApiRequestSuccess(logContext, 400, { action: "previewModulesClear", reason: "no_modules" })
        return withRequestId(response, logContext.requestId)
      }
      const expansion = expandClearModules(selected, mode)
      if (!expansion.ok) {
        const response = NextResponse.json(
          {
            error: "Missing module dependencies for strict mode.",
            details: expansion.missingByModule,
            expandedModules: expansion.expanded,
          },
          { status: 409 }
        )
        logApiRequestSuccess(logContext, 409, { action: "previewModulesClear", reason: "dependency_conflict" })
        return withRequestId(response, logContext.requestId)
      }

      const expandedSet = new Set<ClearModule>(expansion.expanded)
      const preview = await countModuleData(expandedSet)
      const response = NextResponse.json({
        ok: true,
        action: "previewModulesClear",
        selectedModules: Array.from(selected),
        expandedModules: expansion.expanded,
        autoIncludedModules: expansion.expanded.filter((moduleKey) => !selected.has(moduleKey)),
        mode,
        preview: { wouldDelete: preview.counts, preservedAdmins: preview.preservedAdmins },
        message: "Module clear preview generated.",
      })
      logApiRequestSuccess(logContext, 200, { action: "previewModulesClear" })
      return withRequestId(response, logContext.requestId)
    }

    if (parsed.data.action === "clear") {
      const result = await clearData()
      const response = NextResponse.json({
        ok: true,
        action: "clear",
        result,
        message: "Data cleared. Admin users and global settings were preserved.",
      })
      logApiRequestSuccess(logContext, 200, { action: "clear" })
      return withRequestId(response, logContext.requestId)
    }

    if (parsed.data.action === "clearModules") {
      const mode: ClearMode = parsed.data.mode ?? "include_dependents"
      const selected = new Set<ClearModule>(parsed.data.modules ?? [])
      if (selected.size === 0) {
        const response = NextResponse.json({ error: "Select at least one module." }, { status: 400 })
        logApiRequestSuccess(logContext, 400, { action: "clearModules", reason: "no_modules" })
        return withRequestId(response, logContext.requestId)
      }
      const expansion = expandClearModules(selected, mode)
      if (!expansion.ok) {
        const response = NextResponse.json(
          {
            error: "Missing module dependencies for strict mode.",
            details: expansion.missingByModule,
            expandedModules: expansion.expanded,
          },
          { status: 409 }
        )
        logApiRequestSuccess(logContext, 409, { action: "clearModules", reason: "dependency_conflict" })
        return withRequestId(response, logContext.requestId)
      }
      const expandedSet = new Set<ClearModule>(expansion.expanded)
      const result = await clearModulesData(expandedSet)
      const response = NextResponse.json({
        ok: true,
        action: "clearModules",
        selectedModules: Array.from(selected),
        expandedModules: expansion.expanded,
        autoIncludedModules: expansion.expanded.filter((moduleKey) => !selected.has(moduleKey)),
        mode,
        result,
        message: "Selected modules cleared. Global settings and admin users were preserved.",
      })
      logApiRequestSuccess(logContext, 200, { action: "clearModules" })
      return withRequestId(response, logContext.requestId)
    }

  const dependencyMap: Record<SeedGroup, SeedGroup[]> = {
    taxes: [],
    users: [],
    serviceCatalog: ["taxes", "users"],
    inventoryCatalog: ["taxes"],
    purchases: ["inventoryCatalog"],
    leaves: ["users"],
    shifts: ["users"],
    appointments: ["users", "serviceCatalog", "shifts"],
    coupons: [],
  }

  const requested = new Set<SeedGroup>(
    parsed.data.groups && parsed.data.groups.length > 0 ? parsed.data.groups : seedGroupValues
  )
  const done = new Set<SeedGroup>()
  const summary: Record<string, number> = {}

  const runGroup = async (group: SeedGroup) => {
    if (done.has(group)) return
    for (const dependency of dependencyMap[group]) {
      await runGroup(dependency)
    }
    if (group === "taxes") {
      summary.taxes = (await seedTaxes()).count
    } else if (group === "users") {
      summary.users = (await seedUsers()).count
    } else if (group === "serviceCatalog") {
      summary.serviceCatalog = (await seedServiceCatalog()).count
    } else if (group === "inventoryCatalog") {
      summary.inventoryCatalog = (await seedInventoryCatalog()).count
    } else if (group === "purchases") {
      summary.purchases = (await seedPurchases()).count
    } else if (group === "leaves") {
      summary.leaves = (await seedLeaves()).count
    } else if (group === "shifts") {
      summary.shifts = (await seedShifts()).count
    } else if (group === "appointments") {
      summary.appointments = (await seedAppointments()).count
    } else if (group === "coupons") {
      summary.coupons = (await seedCoupons()).count
    }
    done.add(group)
  }

  for (const group of seedGroupValues) {
    if (requested.has(group)) {
      await runGroup(group)
    }
  }

    const response = NextResponse.json({
      ok: true,
      action: "seed",
      summary,
      executedGroups: Array.from(done),
      requestId: randomUUID(),
      message: "Seed data applied successfully.",
    })
    logApiRequestSuccess(logContext, 200, { action: "seed", groups: Array.from(done) })
    return withRequestId(response, logContext.requestId)
  } catch (error) {
    logApiRequestError(logContext, error, 500)
    const response = NextResponse.json({ error: "Unable to process seed request." }, { status: 500 })
    return withRequestId(response, logContext.requestId)
  }
}
