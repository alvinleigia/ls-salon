import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { canManageUsers, type Role } from "@/lib/permissions"
import { updatePurchaseOrderSchema } from "@/lib/validation"

const ensureAuthorized = async () => {
  const session = await auth()
  const role = (session?.user as { role?: string })?.role
  if (!session?.user || !canManageUsers(role as Role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  return null
}

const toDateOnly = (value: string) => new Date(`${value}T00:00:00.000Z`)

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await ensureAuthorized()
  if (unauthorized) return unauthorized

  const { id } = await params
  const body = await request.json()
  const parsed = updatePurchaseOrderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const data = parsed.data
  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.purchaseOrder.findUnique({
      where: { id },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        items: {
          select: {
            id: true,
            productId: true,
            quantity: true,
            receivedQty: true,
            unitCostCents: true,
          },
        },
      },
    })

    if (!existing) {
      throw new Error("NOT_FOUND")
    }

    const nextStatus = data.status ?? existing.status
    const shouldReceive = existing.status !== "RECEIVED" && nextStatus === "RECEIVED"

    const order = await tx.purchaseOrder.update({
      where: { id },
      data: {
        ...(data.status ? { status: data.status } : {}),
        ...(data.expectedDate !== undefined
          ? { expectedDate: data.expectedDate ? toDateOnly(data.expectedDate) : null }
          : {}),
        ...(data.notes !== undefined ? { notes: data.notes?.trim() || null } : {}),
        ...(shouldReceive ? { receivedAt: new Date() } : {}),
      },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        orderDate: true,
        expectedDate: true,
        subtotalCents: true,
        taxCents: true,
        totalCents: true,
        createdAt: true,
        supplier: { select: { id: true, name: true } },
        items: {
          select: {
            id: true,
            quantity: true,
            receivedQty: true,
            unitCostCents: true,
            taxPercent: true,
            lineSubtotalCents: true,
            lineTaxCents: true,
            lineTotalCents: true,
            productId: true,
            product: { select: { id: true, sku: true, name: true } },
          },
        },
      },
    })

    if (shouldReceive) {
      await tx.purchaseOrderItem.updateMany({
        where: { orderId: id },
        data: { receivedQty: 0 },
      })
      await Promise.all(
        existing.items.map(async (item) => {
          const qtyToReceive = item.quantity - item.receivedQty
          if (qtyToReceive <= 0) return

          await tx.purchaseOrderItem.update({
            where: { id: item.id },
            data: { receivedQty: item.quantity },
          })
          await tx.inventoryProduct.update({
            where: { id: item.productId },
            data: {
              onHandQty: { increment: qtyToReceive },
              costPriceCents: item.unitCostCents,
            },
          })
          await tx.inventoryStockMovement.create({
            data: {
              productId: item.productId,
              orderItemId: item.id,
              type: "PURCHASE_RECEIPT",
              quantityDelta: qtyToReceive,
              unitCostCents: item.unitCostCents,
              note: `Purchase receipt ${existing.orderNumber}`,
            },
          })
        })
      )
    }

    return order
  }).catch((error: Error) => {
    if (error.message === "NOT_FOUND") {
      return null
    }
    throw error
  })

  if (!updated) {
    return NextResponse.json({ error: "Purchase order not found." }, { status: 404 })
  }

  return NextResponse.json({
    item: {
      id: updated.id,
      orderNumber: updated.orderNumber,
      supplier: updated.supplier,
      status: updated.status,
      orderDate: updated.orderDate.toISOString().slice(0, 10),
      expectedDate: updated.expectedDate
        ? updated.expectedDate.toISOString().slice(0, 10)
        : null,
      subtotalCents: updated.subtotalCents,
      taxCents: updated.taxCents,
      totalCents: updated.totalCents,
      createdAt: updated.createdAt.toISOString(),
      items: updated.items,
    },
  })
}
