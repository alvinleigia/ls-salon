import { NextResponse } from "next/server"
import { z } from "zod"

import { auth } from "@/auth"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import {
  createServiceCategorySchema,
  serviceCategoryStatusSchema,
} from "@/lib/validation"
import { canManageUsers, type Role } from "@/lib/permissions"

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(["createdAt", "name", "status", "sortOrder"]).optional(),
  order: z.enum(["asc", "desc"]).optional(),
  q: z.string().trim().optional(),
  status: serviceCategoryStatusSchema.optional(),
})

export async function GET(request: Request) {
  const session = await auth()
  const role = (session?.user as { role?: string })?.role

  if (!session?.user || !canManageUsers(role as Role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  const parsed = listSchema.safeParse(Object.fromEntries(url.searchParams.entries()))
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid pagination parameters." },
      { status: 400 }
    )
  }

  const { page, pageSize, sort, order, q, status } = parsed.data
  const skip = (page - 1) * pageSize
  const orderBy = sort
    ? { [sort]: order ?? "asc" }
    : { sortOrder: "asc" as const }
  const trimmedSearch = q?.trim()

  const where = {
    ...(trimmedSearch
      ? {
          OR: [
            { name: { contains: trimmedSearch, mode: Prisma.QueryMode.insensitive } },
            { description: { contains: trimmedSearch, mode: Prisma.QueryMode.insensitive } },
          ],
        }
      : {}),
    ...(status ? { status } : {}),
  }

  const [total, items] = await prisma.$transaction([
    prisma.serviceCategory.count({ where }),
    prisma.serviceCategory.findMany({
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

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return NextResponse.json({ items, page, pageSize, total, totalPages })
}

export async function POST(request: Request) {
  const session = await auth()
  const role = (session?.user as { role?: string })?.role

  if (!session?.user || !canManageUsers(role as Role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const parsed = createServiceCategorySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { name, description, status, sortOrder } = parsed.data

  const existing = await prisma.serviceCategory.findUnique({
    where: { name: name.trim() },
    select: { id: true },
  })
  if (existing) {
    return NextResponse.json(
      { error: "Category name already exists." },
      { status: 409 }
    )
  }

  const item = await prisma.serviceCategory.create({
    data: {
      name: name.trim(),
      description: description?.trim() || undefined,
      status: status ?? "ACTIVE",
      sortOrder: sortOrder ?? 0,
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

  return NextResponse.json({ item })
}
