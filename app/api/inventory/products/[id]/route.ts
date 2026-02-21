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
import { canManageUsers, type Role } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { updateInventoryProductSchema } from "@/lib/validation"

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
  ...item,
  createdAt: item.createdAt.toISOString(),
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
    const parsed = updateInventoryProductSchema.safeParse(body)
    if (!parsed.success) {
      const response = NextResponse.json(
        { error: "Invalid input.", details: parsed.error.flatten() },
        { status: 400 }
      )
      logApiRequestSuccess(logContext, 400, { reason: "validation_failed" })
      return withRequestId(response, logContext.requestId)
    }

    const data = parsed.data
    if (data.sku?.trim()) {
      const existing = await prisma.inventoryProduct.findUnique({
        where: { sku: data.sku.trim() },
        select: { id: true },
      })
      if (existing && existing.id !== id) {
        const response = NextResponse.json({ error: "SKU already exists." }, { status: 409 })
        logApiRequestSuccess(logContext, 409, { reason: "duplicate_sku" })
        return withRequestId(response, logContext.requestId)
      }
    }

    if (data.supplierLinks) {
      const preferredCount = data.supplierLinks.filter((link) => link.isPreferred).length
      if (preferredCount > 1) {
        const response = NextResponse.json(
          { error: "Only one preferred supplier can be selected." },
          { status: 400 }
        )
        logApiRequestSuccess(logContext, 400, { reason: "multiple_preferred_suppliers" })
        return withRequestId(response, logContext.requestId)
      }
    }

    const item = await prisma.$transaction(async (tx) => {
      await tx.inventoryProduct.update({
        where: { id },
        data: {
          ...(data.sku?.trim() ? { sku: data.sku.trim() } : {}),
          ...(data.name?.trim() ? { name: data.name.trim() } : {}),
          ...(data.description !== undefined
            ? { description: data.description?.trim() || null }
            : {}),
          ...(data.unit ? { unit: data.unit } : {}),
          ...(data.categoryId ? { categoryId: data.categoryId } : {}),
          ...(data.status ? { status: data.status } : {}),
          ...(typeof data.costPriceCents === "number"
            ? { costPriceCents: data.costPriceCents }
            : {}),
          ...(typeof data.mrpCents === "number" ? { mrpCents: data.mrpCents } : {}),
          ...(typeof data.reorderPoint === "number" ? { reorderPoint: data.reorderPoint } : {}),
          ...(typeof data.reorderQty === "number" ? { reorderQty: data.reorderQty } : {}),
          ...(typeof data.onHandQty === "number" ? { onHandQty: data.onHandQty } : {}),
          ...(typeof data.isPhysical === "boolean" ? { isPhysical: data.isPhysical } : {}),
        },
      })

      if (data.taxIds) {
        await tx.inventoryProductTax.deleteMany({ where: { productId: id } })
        if (data.taxIds.length > 0) {
          await tx.inventoryProductTax.createMany({
            data: [...new Set(data.taxIds)].map((taxId) => ({
              productId: id,
              taxId,
            })),
          })
        }
      }

      if (data.supplierLinks) {
        await tx.inventoryProductSupplier.deleteMany({ where: { productId: id } })
        if (data.supplierLinks.length > 0) {
          await tx.inventoryProductSupplier.createMany({
            data: data.supplierLinks.map((link) => ({
              productId: id,
              supplierId: link.supplierId,
              supplierSku: link.supplierSku?.trim() || null,
              supplierCostCents: link.supplierCostCents,
              minOrderQty: link.minOrderQty ?? 1,
              leadTimeDays: link.leadTimeDays,
              isPreferred: link.isPreferred ?? false,
            })),
          })
        }
      }

      return tx.inventoryProduct.findUnique({
        where: { id },
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
    })

    const response = NextResponse.json({ item: item ? serializeProduct(item) : null })
    logApiRequestSuccess(logContext, 200, { itemId: id })
    return withRequestId(response, logContext.requestId)
  } catch (error) {
    logApiRequestError(logContext, error, 500)
    const response = NextResponse.json({ error: "Unable to update product." }, { status: 500 })
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
    const linkedPurchases = await prisma.purchaseOrderItem.count({
      where: { productId: id },
    })
    const hasStockMovements = await prisma.inventoryStockMovement.count({
      where: { productId: id },
    })

    if (linkedPurchases > 0 || hasStockMovements > 0) {
      await prisma.inventoryProduct.update({
        where: { id },
        data: { status: "INACTIVE" },
      })
    } else {
      await prisma.inventoryProduct.delete({ where: { id } })
    }

    const response = NextResponse.json({ ok: true })
    logApiRequestSuccess(logContext, 200, { itemId: id, linkedPurchases, hasStockMovements })
    return withRequestId(response, logContext.requestId)
  } catch (error) {
    logApiRequestError(logContext, error, 500)
    const response = NextResponse.json({ error: "Unable to delete product." }, { status: 500 })
    return withRequestId(response, logContext.requestId)
  }
}
