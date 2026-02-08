import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { z } from "zod"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { canManageUsers, type Role } from "@/lib/permissions"
import {
  createInventoryCategorySchema,
  inventoryCategoryStatusSchema,
} from "@/lib/validation"

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(["createdAt", "name", "status", "sortOrder"]).optional(),
  order: z.enum(["asc", "desc"]).optional(),
  q: z.string().trim().optional(),
  status: inventoryCategoryStatusSchema.optional(),
})

const ensureAuthorized = async () => {
  const session = await auth()
  const role = (session?.user as { role?: string })?.role
  if (!session?.user || !canManageUsers(role as Role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  return null
}

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

  const { page, pageSize, sort, order, q, status } = parsed.data
  const skip = (page - 1) * pageSize
  const orderBy = sort
    ? { [sort]: order ?? "asc" }
    : { sortOrder: "asc" as const }

  const where: Prisma.InventoryCategoryWhereInput = {
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(status ? { status } : {}),
  }

  const [total, items] = await prisma.$transaction([
    prisma.inventoryCategory.count({ where }),
    prisma.inventoryCategory.findMany({
      where,
      orderBy,
      skip,
      take: pageSize,
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        sortOrder: true,
        createdAt: true,
      },
    }),
  ])

  return NextResponse.json({
    items: items.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
    })),
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
  const parsed = createInventoryCategorySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const data = parsed.data
  const existing = await prisma.inventoryCategory.findUnique({
    where: { name: data.name.trim() },
    select: { id: true },
  })
  if (existing) {
    return NextResponse.json(
      { error: "Category name already exists." },
      { status: 409 }
    )
  }

  const item = await prisma.inventoryCategory.create({
    data: {
      name: data.name.trim(),
      description: data.description?.trim() || undefined,
      status: data.status ?? "ACTIVE",
      sortOrder: data.sortOrder ?? 0,
    },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      sortOrder: true,
      createdAt: true,
    },
  })

  return NextResponse.json(
    {
      item: {
        ...item,
        createdAt: item.createdAt.toISOString(),
      },
    },
    { status: 201 }
  )
}
