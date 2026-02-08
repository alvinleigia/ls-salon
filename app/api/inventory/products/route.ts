import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { z } from "zod"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { canManageUsers, type Role } from "@/lib/permissions"
import {
  createInventoryProductSchema,
  inventoryProductStatusSchema,
} from "@/lib/validation"

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z
    .enum([
      "createdAt",
      "sku",
      "name",
      "status",
      "mrpCents",
      "costPriceCents",
      "onHandQty",
      "category",
    ])
    .optional(),
  order: z.enum(["asc", "desc"]).optional(),
  q: z.string().trim().optional(),
  status: inventoryProductStatusSchema.optional(),
  categoryId: z.string().trim().optional(),
})

const ensureAuthorized = async () => {
  const session = await auth()
  const role = (session?.user as { role?: string })?.role
  if (!session?.user || !canManageUsers(role as Role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  return null
}

const serializeProduct = (item: {
  id: string
  sku: string
  name: string
  description: string | null
  unit: string
  status: "ACTIVE" | "INACTIVE"
  costPriceCents: number
  mrpCents: number
  reorderPoint: number
  reorderQty: number
  onHandQty: number
  isPhysical: boolean
  createdAt: Date
  category: { id: string; name: string }
  taxes: { taxId: string }[]
  suppliers: {
    supplierId: string
    supplierSku: string | null
    supplierCostCents: number | null
    minOrderQty: number
    leadTimeDays: number | null
    isPreferred: boolean
    supplier: { name: string }
  }[]
}) => ({
  id: item.id,
  sku: item.sku,
  name: item.name,
  description: item.description,
  unit: item.unit,
  status: item.status,
  costPriceCents: item.costPriceCents,
  mrpCents: item.mrpCents,
  reorderPoint: item.reorderPoint,
  reorderQty: item.reorderQty,
  onHandQty: item.onHandQty,
  isPhysical: item.isPhysical,
  createdAt: item.createdAt.toISOString(),
  category: item.category,
  taxIds: item.taxes.map((tax) => tax.taxId),
  supplierLinks: item.suppliers.map((link) => ({
    supplierId: link.supplierId,
    supplierName: link.supplier.name,
    supplierSku: link.supplierSku,
    supplierCostCents: link.supplierCostCents,
    minOrderQty: link.minOrderQty,
    leadTimeDays: link.leadTimeDays,
    isPreferred: link.isPreferred,
  })),
})

export async function GET(request: Request) {
  const unauthorized = await ensureAuthorized()
  if (unauthorized) return unauthorized

  const url = new URL(request.url)
  const parsed = listSchema.safeParse(Object.fromEntries(url.searchParams.entries()))
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid pagination parameters.", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { page, pageSize, sort, order, q, status, categoryId } = parsed.data
  const skip = (page - 1) * pageSize
  const sortDirection = order ?? "asc"
  const orderBy =
    sort === "category"
      ? { category: { name: sortDirection } }
      : sort
        ? { [sort]: sortDirection }
        : { createdAt: "desc" as const }
  const where: Prisma.InventoryProductWhereInput = {
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { sku: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(status ? { status } : {}),
    ...(categoryId ? { categoryId } : {}),
  }

  const [total, items] = await prisma.$transaction([
    prisma.inventoryProduct.count({ where }),
    prisma.inventoryProduct.findMany({
      where,
      orderBy,
      skip,
      take: pageSize,
      select: {
        id: true,
        sku: true,
        name: true,
        description: true,
        unit: true,
        status: true,
        costPriceCents: true,
        mrpCents: true,
        reorderPoint: true,
        reorderQty: true,
        onHandQty: true,
        isPhysical: true,
        createdAt: true,
        category: { select: { id: true, name: true } },
        taxes: { select: { taxId: true } },
        suppliers: {
          orderBy: [{ isPreferred: "desc" }, { supplier: { name: "asc" } }],
          select: {
            supplierId: true,
            supplierSku: true,
            supplierCostCents: true,
            minOrderQty: true,
            leadTimeDays: true,
            isPreferred: true,
            supplier: { select: { name: true } },
          },
        },
      },
    }),
  ])

  return NextResponse.json({
    items: items.map(serializeProduct),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  })
}

export async function POST(request: Request) {
  const unauthorized = await ensureAuthorized()
  if (unauthorized) return unauthorized

  const body = await request.json()
  const parsed = createInventoryProductSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const data = parsed.data
  const existing = await prisma.inventoryProduct.findUnique({
    where: { sku: data.sku.trim() },
    select: { id: true },
  })
  if (existing) {
    return NextResponse.json({ error: "SKU already exists." }, { status: 409 })
  }

  const preferredCount = data.supplierLinks.filter((link) => link.isPreferred).length
  if (preferredCount > 1) {
    return NextResponse.json(
      { error: "Only one preferred supplier can be selected." },
      { status: 400 }
    )
  }

  const item = await prisma.inventoryProduct.create({
    data: {
      sku: data.sku.trim(),
      name: data.name.trim(),
      description: data.description?.trim() || undefined,
      unit: data.unit?.trim() || "unit",
      categoryId: data.categoryId,
      status: data.status ?? "ACTIVE",
      costPriceCents: data.costPriceCents,
      mrpCents: data.mrpCents,
      reorderPoint: data.reorderPoint ?? 0,
      reorderQty: data.reorderQty ?? 0,
      onHandQty: data.onHandQty ?? 0,
      isPhysical: data.isPhysical ?? true,
      taxes: data.taxIds.length
        ? {
            create: [...new Set(data.taxIds)].map((taxId) => ({ taxId })),
          }
        : undefined,
      suppliers: data.supplierLinks.length
        ? {
            create: data.supplierLinks.map((link) => ({
              supplierId: link.supplierId,
              supplierSku: link.supplierSku?.trim() || undefined,
              supplierCostCents: link.supplierCostCents,
              minOrderQty: link.minOrderQty ?? 1,
              leadTimeDays: link.leadTimeDays,
              isPreferred: link.isPreferred ?? false,
            })),
          }
        : undefined,
    },
    select: {
      id: true,
      sku: true,
      name: true,
      description: true,
      unit: true,
      status: true,
      costPriceCents: true,
      mrpCents: true,
      reorderPoint: true,
      reorderQty: true,
      onHandQty: true,
      isPhysical: true,
      createdAt: true,
      category: { select: { id: true, name: true } },
      taxes: { select: { taxId: true } },
      suppliers: {
        orderBy: [{ isPreferred: "desc" }, { supplier: { name: "asc" } }],
        select: {
          supplierId: true,
          supplierSku: true,
          supplierCostCents: true,
          minOrderQty: true,
          leadTimeDays: true,
          isPreferred: true,
          supplier: { select: { name: true } },
        },
      },
    },
  })

  return NextResponse.json({ item: serializeProduct(item) }, { status: 201 })
}
