import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { z } from "zod"

import { auth } from "@/auth"
import {
  createApiLogContext,
  logApiRequestError,
  logApiRequestStart,
  logApiRequestSuccess,
  withRequestId,
} from "@/lib/api-logging"
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
  const logContext = createApiLogContext(request)
  logApiRequestStart(logContext, request)

  const unauthorized = await ensureAuthorized()
  if (unauthorized) {
    logApiRequestSuccess(logContext, 401, { reason: "unauthorized" })
    return withRequestId(unauthorized, logContext.requestId)
  }

  const url = new URL(request.url)
  const parsed = listSchema.safeParse(Object.fromEntries(url.searchParams.entries()))
  if (!parsed.success) {
    const response = NextResponse.json(
      { error: "Invalid pagination parameters.", details: parsed.error.flatten() },
      { status: 400 }
    )
    logApiRequestSuccess(logContext, 400, { reason: "validation_failed" })
    return withRequestId(response, logContext.requestId)
  }

  try {
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

    const response = NextResponse.json({
      items: items.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
      })),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    })
    logApiRequestSuccess(logContext, 200, { page, pageSize, total })
    return withRequestId(response, logContext.requestId)
  } catch (error) {
    logApiRequestError(logContext, error, 500)
    const response = NextResponse.json({ error: "Unable to load inventory categories." }, { status: 500 })
    return withRequestId(response, logContext.requestId)
  }
}

export async function POST(request: Request) {
  const logContext = createApiLogContext(request)
  logApiRequestStart(logContext, request)

  const unauthorized = await ensureAuthorized()
  if (unauthorized) {
    logApiRequestSuccess(logContext, 401, { reason: "unauthorized" })
    return withRequestId(unauthorized, logContext.requestId)
  }

  const body = await request.json().catch(() => null)
  if (!body) {
    const response = NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
    logApiRequestSuccess(logContext, 400, { reason: "invalid_json" })
    return withRequestId(response, logContext.requestId)
  }
  const parsed = createInventoryCategorySchema.safeParse(body)
  if (!parsed.success) {
    const response = NextResponse.json(
      { error: "Invalid input.", details: parsed.error.flatten() },
      { status: 400 }
    )
    logApiRequestSuccess(logContext, 400, { reason: "validation_failed" })
    return withRequestId(response, logContext.requestId)
  }

  try {
    const data = parsed.data
    const existing = await prisma.inventoryCategory.findUnique({
      where: { name: data.name.trim() },
      select: { id: true },
    })
    if (existing) {
      const response = NextResponse.json(
        { error: "Category name already exists." },
        { status: 409 }
      )
      logApiRequestSuccess(logContext, 409, { reason: "name_conflict" })
      return withRequestId(response, logContext.requestId)
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

    const response = NextResponse.json(
      {
        item: {
          ...item,
          createdAt: item.createdAt.toISOString(),
        },
      },
      { status: 201 }
    )
    logApiRequestSuccess(logContext, 201, { categoryId: item.id })
    return withRequestId(response, logContext.requestId)
  } catch (error) {
    logApiRequestError(logContext, error, 500)
    const response = NextResponse.json({ error: "Unable to create inventory category." }, { status: 500 })
    return withRequestId(response, logContext.requestId)
  }
}
