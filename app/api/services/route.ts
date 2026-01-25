import { NextResponse } from "next/server"
import { z } from "zod"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { createServiceSchema, serviceStatusSchema } from "@/lib/validation"
import { canManageUsers, type Role } from "@/lib/permissions"

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z
    .enum(["createdAt", "name", "status", "durationMinutes", "priceCents"])
    .optional(),
  order: z.enum(["asc", "desc"]).optional(),
  q: z.string().trim().optional(),
  status: serviceStatusSchema.optional(),
  categoryId: z.string().trim().optional(),
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

  const { page, pageSize, sort, order, q, status, categoryId } = parsed.data
  const skip = (page - 1) * pageSize
  const orderBy = sort
    ? { [sort]: order ?? "asc" }
    : { createdAt: "desc" as const }
  const trimmedSearch = q?.trim()

  const where = {
    ...(trimmedSearch
      ? {
          OR: [
            { name: { contains: trimmedSearch, mode: "insensitive" } },
            { description: { contains: trimmedSearch, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(status ? { status } : {}),
    ...(categoryId ? { categoryId } : {}),
  }

  const [total, items] = await prisma.$transaction([
    prisma.service.count({ where }),
    prisma.service.findMany({
      where,
      orderBy,
      skip,
      take: pageSize,
      select: {
        id: true,
        name: true,
        description: true,
        durationMinutes: true,
        priceCents: true,
        status: true,
        createdAt: true,
        category: { select: { id: true, name: true } },
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
  const parsed = createServiceSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { name, description, categoryId, durationMinutes, priceCents, status } =
    parsed.data

  const item = await prisma.service.create({
    data: {
      name: name.trim(),
      description: description?.trim() || undefined,
      categoryId,
      durationMinutes,
      priceCents,
      status: status ?? "ACTIVE",
    },
    select: {
      id: true,
      name: true,
      description: true,
      durationMinutes: true,
      priceCents: true,
      status: true,
      createdAt: true,
      category: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json({ item })
}
