import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { z } from "zod"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { canManageUsers, type Role } from "@/lib/permissions"
import { taxCreateSchema } from "@/lib/validation"
import type { ListResponse } from "@/types/api"
import type { TaxRow } from "@/types/scheduling"

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().optional(),
  active: z
    .string()
    .optional()
    .transform((value) => (value === undefined ? undefined : value === "true")),
})

const ensureAuthorized = async () => {
  const session = await auth()
  const role = (session?.user as { role?: string })?.role
  if (!session?.user || !canManageUsers(role as Role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  return null
}

const serializeTax = (tax: {
  id: string
  name: string
  percent: number
  isActive: boolean
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}): TaxRow => ({
  id: tax.id,
  name: tax.name,
  percent: tax.percent,
  isActive: tax.isActive,
  sortOrder: tax.sortOrder,
  createdAt: tax.createdAt.toISOString(),
  updatedAt: tax.updatedAt.toISOString(),
})

export async function GET(request: Request) {
  const unauthorized = await ensureAuthorized()
  if (unauthorized) return unauthorized

  const url = new URL(request.url)
  const parsed = listSchema.safeParse(Object.fromEntries(url.searchParams.entries()))
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query parameters.", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { page, pageSize, q, active } = parsed.data
  const where: Prisma.TaxWhereInput = {}
  if (q) {
    where.name = { contains: q, mode: "insensitive" }
  }
  if (active !== undefined) {
    where.isActive = active
  }

  const skip = (page - 1) * pageSize
  const [total, items] = await prisma.$transaction([
    prisma.tax.count({ where }),
    prisma.tax.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      skip,
      take: pageSize,
    }),
  ])

  const response: ListResponse<TaxRow> = {
    items: items.map(serializeTax),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  }

  return NextResponse.json(response)
}

export async function POST(request: Request) {
  const unauthorized = await ensureAuthorized()
  if (unauthorized) return unauthorized

  const payload = await request.json()
  const parsed = taxCreateSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const data = parsed.data
  const tax = await prisma.tax.create({
    data: {
      name: data.name.trim(),
      percent: data.percent,
      isActive: data.isActive ?? true,
      sortOrder: data.sortOrder ?? 0,
    },
  })

  return NextResponse.json({ tax: serializeTax(tax) }, { status: 201 })
}
