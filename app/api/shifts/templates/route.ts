import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { shiftTemplateSchema } from "@/lib/validation"
import { canManageUsers, type Role } from "@/lib/permissions"
import type { ListResponse } from "@/types/api"

export async function GET(request: Request) {
  const session = await auth()
  const role = (session?.user as { role?: string })?.role

  if (!session?.user || !canManageUsers(role as Role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  const searchParams = url.searchParams
  const includeInactive = searchParams.get("includeInactive") === "true"
  const q = searchParams.get("q")?.trim()
  const status = searchParams.get("status")
  const sort = searchParams.get("sort") ?? "name"
  const order = searchParams.get("order") === "desc" ? "desc" : "asc"
  const pageParamRaw = searchParams.get("page")
  const pageSizeParamRaw = searchParams.get("pageSize")
  const hasPagination = pageParamRaw !== null && pageSizeParamRaw !== null
  const pageParam = hasPagination ? Number(pageParamRaw) : NaN
  const pageSizeParam = hasPagination ? Number(pageSizeParamRaw) : NaN
  const page = hasPagination ? Math.max(1, pageParam) : 1
  const pageSize = hasPagination ? Math.max(1, pageSizeParam) : undefined

  const where: {
    isActive?: boolean
    OR?: { name?: { contains: string; mode: "insensitive" } }[]
  } = {}

  if (!includeInactive) {
    if (status === "INACTIVE") {
      where.isActive = false
    } else if (status === "ACTIVE") {
      where.isActive = true
    } else {
      where.isActive = true
    }
  } else if (status === "INACTIVE") {
    where.isActive = false
  } else if (status === "ACTIVE") {
    where.isActive = true
  }

  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ]
  }

  const orderBy =
    sort === "createdAt" || sort === "updatedAt"
      ? { [sort]: order }
      : { name: order }

  const total = await prisma.shiftTemplate.count({ where })
  const templates = await prisma.shiftTemplate.findMany({
    where,
    include: { breaks: { orderBy: { sortOrder: "asc" } } },
    orderBy,
    skip: pageSize ? (page - 1) * pageSize : undefined,
    take: pageSize ?? undefined,
  })

  const effectivePageSize = pageSize ?? (total || templates.length || 1)
  const totalPages = Math.max(1, Math.ceil(total / effectivePageSize))
  const response: ListResponse<typeof templates[number]> = {
    items: templates,
    page,
    pageSize: effectivePageSize,
    total,
    totalPages,
  }

  return NextResponse.json(response)
}

export async function POST(request: Request) {
  const session = await auth()
  const role = (session?.user as { role?: string })?.role

  if (!session?.user || !canManageUsers(role as Role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const parsed = shiftTemplateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const data = parsed.data
  const template = await prisma.shiftTemplate.create({
    data: {
      name: data.name,
      description: data.description || null,
      color: data.color || null,
      isActive: data.isActive ?? true,
      startTime: data.startTime,
      endTime: data.endTime,
      breaks: {
        create: data.breaks.map((period, index) => ({
          startTime: period.startTime,
          endTime: period.endTime,
          sortOrder: period.sortOrder ?? index,
        })),
      },
    },
    include: { breaks: { orderBy: { sortOrder: "asc" } } },
  })

  return NextResponse.json({ template })
}
