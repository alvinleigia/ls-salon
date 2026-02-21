import { NextResponse } from "next/server"

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
import { requireTenantSession } from "@/lib/tenant-auth"

const ensureAuthorized = async (request: Request, logContext: ApiLogContext) => {
  const tenantSession = await requireTenantSession(request)
  if (tenantSession.error) {
    const response = tenantSession.error
    logApiRequestSuccess(logContext, response.status, { reason: "tenant_or_auth_failed" })
    return withRequestId(response, logContext.requestId)
  }
  if (!canManageUsers(tenantSession.context.role as Role)) {
    const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    logApiRequestSuccess(logContext, 401, { reason: "unauthorized" })
    return withRequestId(response, logContext.requestId)
  }
  return tenantSession.context
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const logContext = createApiLogContext(request)
  logApiRequestStart(logContext, request)
  const authorized = await ensureAuthorized(request, logContext)
  if ("status" in authorized) return authorized
  const { tenantId } = authorized

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
        where: { tenantId_name: { tenantId, name: data.name.trim() } },
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

    const item = await prisma.inventoryCategory.updateManyAndReturn({
      where: { id, tenantId },
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

    const updatedItem = item[0]
    if (!updatedItem) {
      const response = NextResponse.json({ error: "Category not found." }, { status: 404 })
      logApiRequestSuccess(logContext, 404, { reason: "not_found", itemId: id })
      return withRequestId(response, logContext.requestId)
    }
    const response = NextResponse.json({
      item: {
        ...updatedItem,
        createdAt: updatedItem.createdAt.toISOString(),
      },
    })
    logApiRequestSuccess(logContext, 200, { itemId: updatedItem.id })
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
  const authorized = await ensureAuthorized(request, logContext)
  if ("status" in authorized) return authorized
  const { tenantId } = authorized

  try {
    const { id } = await params
    const linkedProducts = await prisma.inventoryProduct.count({
      where: { tenantId, categoryId: id },
    })

    if (linkedProducts > 0) {
      await prisma.inventoryCategory.updateMany({
        where: { id, tenantId },
        data: { status: "INACTIVE" },
      })
    } else {
      await prisma.inventoryCategory.deleteMany({ where: { id, tenantId } })
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
