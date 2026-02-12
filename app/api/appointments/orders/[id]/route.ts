import { AppointmentStatus } from "@prisma/client"
import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import {
  appointmentOrderCreateSchema,
  appointmentOrderUpdateSchema,
} from "@/lib/validation"
import { canManageUsers, type Role } from "@/lib/permissions"
import {
  appointmentOrderInclude,
  serializeAppointmentOrder,
} from "../_helpers"
import {
  applyStockDelta,
  buildStockDeltaForOrderUpdate,
  StockConflictError,
} from "../_inventory"
import { resolveOrderData } from "../_resolve"
import {
  AvailabilityConflictError,
  scheduleConfirmedOrderLines,
} from "../_scheduling"

const ACTIVE_APPOINTMENT_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.SCHEDULED,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.IN_PROGRESS,
]

const ensureAuthorized = async () => {
  const session = await auth()
  const role = (session?.user as { role?: string })?.role
  if (!session?.user || !canManageUsers(role as Role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  return null
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await ensureAuthorized()
  if (unauthorized) return unauthorized

  const { id } = await params
  const order = await prisma.appointmentOrder.findUnique({
    where: { id },
    include: appointmentOrderInclude,
  })
  if (!order) {
    return NextResponse.json({ error: "Appointment order not found." }, { status: 404 })
  }
  return NextResponse.json({ order: serializeAppointmentOrder(order) })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await ensureAuthorized()
  if (unauthorized) return unauthorized

  const { id } = await params
  const payload = await request.json()
  const parsed = appointmentOrderUpdateSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const currentOrder = await prisma.appointmentOrder.findUnique({
    where: { id },
    include: {
      ...appointmentOrderInclude,
      lines: {
        include: {
          service: { select: { id: true, name: true, durationMinutes: true, priceCents: true } },
          staffProfile: {
            include: { user: { select: { id: true, name: true, email: true } } },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  })
  if (!currentOrder) {
    return NextResponse.json({ error: "Appointment order not found." }, { status: 404 })
  }

  const timeFromCurrent = `${String(currentOrder.appointmentStartAt.getHours()).padStart(2, "0")}:${String(currentOrder.appointmentStartAt.getMinutes()).padStart(2, "0")}`
  const nextInput = appointmentOrderCreateSchema.parse({
    customerId: parsed.data.customerId ?? currentOrder.customerId,
    appointmentDate:
      parsed.data.appointmentDate ?? currentOrder.appointmentDate.toISOString().slice(0, 10),
    appointmentStartTime: parsed.data.appointmentStartTime ?? timeFromCurrent,
    appointmentStartAt: parsed.data.appointmentStartAt ?? currentOrder.appointmentStartAt.toISOString(),
    status: parsed.data.status ?? currentOrder.status,
    customerNote: parsed.data.customerNote ?? currentOrder.customerNote ?? "",
    internalNote: parsed.data.internalNote ?? currentOrder.internalNote ?? "",
    coupons: parsed.data.coupons ?? currentOrder.coupons.map((coupon) => coupon.code),
    lines:
      parsed.data.lines ??
      currentOrder.lines.map((line) => ({
        serviceId: line.serviceId,
        staffId: line.staffProfile.user.id,
        quantity: line.quantity,
        durationMinutes: line.durationMinutes,
        unitPriceCents: line.unitPriceCents,
        discountType: line.discountType,
        discountValue: line.discountValue,
        taxMode: line.taxMode,
        taxIds: line.taxIds,
        note: line.note ?? "",
      })),
    productLines:
      parsed.data.productLines ??
      currentOrder.productLines.map((line) => ({
        productId: line.productId,
        quantity: line.quantity,
        unitPriceCents: line.unitPriceCents,
        discountType: line.discountType,
        discountValue: line.discountValue,
        taxMode: line.taxMode,
        taxIds: line.taxIds,
        note: line.note ?? "",
      })),
  })

  if (nextInput.status === "DRAFT" && currentOrder.status !== "DRAFT") {
    return NextResponse.json(
      { error: "Confirmed/completed orders cannot be moved back to draft." },
      { status: 400 }
    )
  }

  try {
    const resolved = await resolveOrderData(nextInput, { existingOrderId: id })
    const existingAppointments = await prisma.appointment.findMany({
      where: { orderLine: { is: { orderId: id } } },
      select: { id: true },
    })
    const excludedIds = existingAppointments.map((item) => item.id)
    const scheduledLines =
      resolved.status === "CONFIRMED"
        ? await scheduleConfirmedOrderLines(resolved.lines, resolved.customerId, excludedIds)
        : resolved.lines

    const updated = await prisma.$transaction(async (tx) => {
      const order = await tx.appointmentOrder.update({
        where: { id },
        data: {
          customerId: resolved.customerId,
          appointmentDate: resolved.appointmentDate,
          appointmentStartAt: resolved.appointmentStartAt,
          status: resolved.status,
          customerNote: resolved.customerNote,
          internalNote: resolved.internalNote,
          subtotalCents: resolved.totals.subtotalCents,
          lineDiscountCents: resolved.totals.lineDiscountCents,
          couponDiscountCents: resolved.totals.couponDiscountCents,
          taxCents: resolved.totals.taxCents,
          totalCents: resolved.totals.totalCents,
          lines: {
            deleteMany: {},
            create: scheduledLines.map((line) => ({
              serviceId: line.serviceId,
              staffProfileId: line.staffProfileId,
              quantity: line.quantity,
              durationMinutes: line.durationMinutes,
              unitPriceCents: line.unitPriceCents,
              discountType: line.discountType,
              discountValue: line.discountValue,
              taxMode: line.taxMode,
              taxIds: line.taxIds,
              lineSubtotalCents: line.lineSubtotalCents,
              lineDiscountCents: line.lineDiscountCents,
              lineTaxCents: line.lineTaxCents,
              lineTotalCents: line.lineTotalCents,
              startAt: line.startAt,
              endAt: line.endAt,
              note: line.note,
              sortOrder: line.sortOrder,
            })),
          },
          productLines: {
            deleteMany: {},
            create: resolved.productLines.map((line) => ({
              productId: line.productId,
              quantity: line.quantity,
              unitPriceCents: line.unitPriceCents,
              discountType: line.discountType,
              discountValue: line.discountValue,
              taxMode: line.taxMode,
              taxIds: line.taxIds,
              lineSubtotalCents: line.lineSubtotalCents,
              lineDiscountCents: line.lineDiscountCents,
              lineTaxCents: line.lineTaxCents,
              lineTotalCents: line.lineTotalCents,
              note: line.note,
              sortOrder: line.sortOrder,
            })),
          },
          coupons: {
            deleteMany: {},
            create: resolved.coupons.map((coupon) => ({
              code: coupon.code,
              discountType: coupon.discountType,
              discountValue: coupon.discountValue,
              discountCents: coupon.discountCents,
            })),
          },
          taxes: {
            deleteMany: {},
            create: resolved.taxes.map((tax) => ({
              taxId: tax.taxId,
              name: tax.name,
              percent: tax.percent,
              taxCents: tax.taxCents,
            })),
          },
        },
        include: appointmentOrderInclude,
      })

      if (resolved.status === "CONFIRMED") {
        await tx.appointment.deleteMany({
          where: { orderLine: { is: { orderId: id } } },
        })
        const createdLineBySortOrder = new Map(
          order.lines.map((line) => [line.sortOrder, line])
        )
        await tx.appointment.createMany({
          data: scheduledLines
            .flatMap((line) => {
              const createdLine = createdLineBySortOrder.get(line.sortOrder)
              if (!createdLine) return []
              return [{
                staffProfileId: line.staffProfileId,
                customerId: order.customerId,
                serviceId: line.serviceId,
                startAt: line.startAt,
                endAt: line.endAt,
                status: AppointmentStatus.SCHEDULED,
                orderLineId: createdLine.id,
              }]
            })
        })
      } else if (resolved.status === "CANCELED") {
        await tx.appointment.updateMany({
          where: { orderLine: { is: { orderId: id } } },
          data: { status: AppointmentStatus.CANCELED },
        })
      } else if (resolved.status === "COMPLETED") {
        await tx.appointment.updateMany({
          where: {
            orderLine: { is: { orderId: id } },
            status: { in: ACTIVE_APPOINTMENT_STATUSES },
          },
          data: { status: AppointmentStatus.COMPLETED },
        })
      } else {
        await tx.appointment.deleteMany({
          where: { orderLine: { is: { orderId: id } } },
        })
      }

      const stockDelta = buildStockDeltaForOrderUpdate({
        previousStatus: currentOrder.status,
        nextStatus: resolved.status,
        previousLines: currentOrder.productLines.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
        })),
        nextLines: resolved.productLines.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
        })),
      })
      await applyStockDelta({
        tx,
        deltaByProduct: stockDelta,
        orderId: order.id,
      })

      return order
    })

    return NextResponse.json({ order: serializeAppointmentOrder(updated) })
  } catch (error) {
    if (error instanceof AvailabilityConflictError) {
      return NextResponse.json(
        {
          error: error.message,
          suggestedStartAt: error.suggestedStartAt,
          canApplySuggestion: Boolean(error.suggestedStartAt),
        },
        { status: 409 }
      )
    }
    if (error instanceof StockConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update booking order." },
      { status: 400 }
    )
  }
}
