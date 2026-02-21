import { NextResponse } from "next/server"

import { auth } from "@/auth"
import {
  type ApiLogContext,
  createApiLogContext,
  logApiRequestError,
  logApiRequestStart,
  logApiRequestSuccess,
  withRequestId,
} from "@/lib/api-logging"
import { prisma } from "@/lib/prisma"
import { canManageUsers, type Role } from "@/lib/permissions"
import { updateInventoryCategorySchema } from "@/lib/validation"

const ensureAuthorized = async (logContext: ApiLogContext) => {
  const session = await auth()
  const role = (session?.user as { role?: string })?.role
  if (!session?.user || !canManageUsers(role as Role)) {
    const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    logApiRequestSuccess(logContext, 401, { reason: "unauthorized" })
    return withRequestId(response, logContext.requestId)
  }
  return null
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const logContext = createApiLogContext(request)
  logApiRequestStart(logContext, request)
  const unauthorized = await ensureAuthorized(logContext)
  if (unauthorized) return unauthorized

  try {
    const { id } = await params
    const body = await request.json()
    const parsed = updateInventoryCategorySchema.safeParse(body)
    if (!parsed.success) {
      const response = NextResponse.json(
        { error: "Invalid input.", details: parsed.error.flatten() },
        { status: 400 }
      )
      logApiRequestSuccess(logContext, 400, { reason: "validation_failed" })
      return withRequestId(response, logContext.requestId)
    }

    const data = parsed.data
    if (data.name?.trim()) {
      const existing = await prisma.inventoryCategory.findUnique({
        where: { name: data.name.trim() },
        select: { id: true },
      })
      if (existing && existing.id !== id) {
        const response = NextResponse.json(
          { error: "Category name already exists." },
          { status: 409 }
        )
        logApiRequestSuccess(logContext, 409, { reason: "duplicate_name" })
        return withRequestId(response, logContext.requestId)
      }
    }

    const item = await prisma.inventoryCategory.update({
      where: { id },
      data: {
        ...(data.name?.trim() ? { name: data.name.trim() } : {}),
        ...(data.description?.trim()
          ? { description: data.description.trim() }
          : data.description === ""
            ? { description: null }
            : {}),
        ...(data.status ? { status: data.status } : {}),
        ...(typeof data.sortOrder === "number" ? { sortOrder: data.sortOrder } : {}),
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

    const response = NextResponse.json({
      item: {
        ...item,
        createdAt: item.createdAt.toISOString(),
      },
    })
    logApiRequestSuccess(logContext, 200, { itemId: item.id })
    return withRequestId(response, logContext.requestId)
  } catch (error) {
    logApiRequestError(logContext, error, 500)
    const response = NextResponse.json({ error: "Unable to update category." }, { status: 500 })
    return withRequestId(response, logContext.requestId)
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const logContext = createApiLogContext(request)
  logApiRequestStart(logContext, request)
  const unauthorized = await ensureAuthorized(logContext)
  if (unauthorized) return unauthorized

  try {
    const { id } = await params
    const linkedProducts = await prisma.inventoryProduct.count({
      where: { categoryId: id },
    })

    if (linkedProducts > 0) {
      await prisma.inventoryCategory.update({
        where: { id },
        data: { status: "INACTIVE" },
      })
    } else {
      await prisma.inventoryCategory.delete({ where: { id } })
    }

    const response = NextResponse.json({ ok: true })
    logApiRequestSuccess(logContext, 200, { itemId: id, linkedProducts })
    return withRequestId(response, logContext.requestId)
  } catch (error) {
    logApiRequestError(logContext, error, 500)
    const response = NextResponse.json({ error: "Unable to delete category." }, { status: 500 })
    return withRequestId(response, logContext.requestId)
  }
}
