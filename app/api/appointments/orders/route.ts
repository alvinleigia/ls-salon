import { AppointmentStatus, Prisma } from "@prisma/client"
import { NextResponse } from "next/server"
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
import {
  appointmentOrderCreateSchema,
} from "@/lib/validation"
import { canManageUsers, type Role } from "@/lib/permissions"
import type { ListResponse } from "@/types/api"
import type { AppointmentOrderRow } from "@/types/appointments"
import {
  appointmentOrderInclude,
  serializeAppointmentOrder,
} from "./_helpers"
import {
  applyStockDelta,
  buildStockDeltaForOrderUpdate,
  StockConflictError,
} from "./_inventory"
import { resolveOrderData } from "./_resolve"
import {
  AvailabilityConflictError,
  scheduleConfirmedOrderLines,
} from "./_scheduling"

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["DRAFT", "CONFIRMED", "COMPLETED", "CANCELED"]).optional(),
  customerId: z.string().trim().optional(),
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
      { error: "Invalid query parameters.", details: parsed.error.flatten() },
      { status: 400 }
    )
    logApiRequestSuccess(logContext, 400, { reason: "validation_failed" })
    return withRequestId(response, logContext.requestId)
  }

  try {
    const { page, pageSize, status, customerId } = parsed.data
    const where: Prisma.AppointmentOrderWhereInput = {}
    if (status) where.status = status
    if (customerId) where.customerId = customerId

    const skip = (page - 1) * pageSize
    const [total, orders] = await prisma.$transaction([
      prisma.appointmentOrder.count({ where }),
      prisma.appointmentOrder.findMany({
        where,
        include: appointmentOrderInclude,
        orderBy: { updatedAt: "desc" },
        skip,
        take: pageSize,
      }),
    ])

    const response: ListResponse<AppointmentOrderRow> = {
      items: orders.map(serializeAppointmentOrder),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    }

    const json = NextResponse.json(response)
    logApiRequestSuccess(logContext, 200, { page, pageSize, total })
    return withRequestId(json, logContext.requestId)
  } catch (error) {
    logApiRequestError(logContext, error, 500)
    const response = NextResponse.json({ error: "Unable to load booking orders." }, { status: 500 })
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

  const payload = await request.json()
  const parsed = appointmentOrderCreateSchema.safeParse(payload)
  if (!parsed.success) {
    const response = NextResponse.json(
      { error: "Invalid input.", details: parsed.error.flatten() },
      { status: 400 }
    )
    logApiRequestSuccess(logContext, 400, { reason: "validation_failed" })
    return withRequestId(response, logContext.requestId)
  }

  try {
    const resolved = await resolveOrderData(parsed.data, { enforceFutureStartAt: true })
    const scheduledLines =
      resolved.status === "CONFIRMED"
        ? await scheduleConfirmedOrderLines(resolved.lines, resolved.customerId)
        : resolved.lines

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.appointmentOrder.create({
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
            create: resolved.coupons.map((coupon) => ({
              code: coupon.code,
              discountType: coupon.discountType,
              discountValue: coupon.discountValue,
              discountCents: coupon.discountCents,
            })),
          },
          taxes: {
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
        const createdLineBySortOrder = new Map(
          created.lines.map((line) => [line.sortOrder, line])
        )
        await tx.appointment.createMany({
          data: scheduledLines
            .flatMap((line) => {
              const createdLine = createdLineBySortOrder.get(line.sortOrder)
              if (!createdLine) return []
              return [{
                staffProfileId: line.staffProfileId,
                customerId: created.customerId,
                serviceId: line.serviceId,
                startAt: line.startAt,
                endAt: line.endAt,
                status: AppointmentStatus.SCHEDULED,
                orderLineId: createdLine.id,
              }]
            })
        })
      }

      const stockDelta = buildStockDeltaForOrderUpdate({
        previousStatus: "DRAFT",
        nextStatus: resolved.status,
        previousLines: [],
        nextLines: resolved.productLines.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
        })),
      })
      await applyStockDelta({
        tx,
        deltaByProduct: stockDelta,
        orderId: created.id,
      })

      return created
    })

    const response = NextResponse.json({ order: serializeAppointmentOrder(order) }, { status: 201 })
    logApiRequestSuccess(logContext, 201, { orderId: order.id, status: order.status })
    return withRequestId(response, logContext.requestId)
  } catch (error) {
    if (error instanceof AvailabilityConflictError) {
      const response = NextResponse.json(
        {
          error: error.message,
          suggestedStartAt: error.suggestedStartAt,
          canApplySuggestion: Boolean(error.suggestedStartAt),
        },
        { status: 409 }
      )
      logApiRequestSuccess(logContext, 409, { reason: "availability_conflict" })
      return withRequestId(response, logContext.requestId)
    }
    if (error instanceof StockConflictError) {
      const response = NextResponse.json({ error: error.message }, { status: 409 })
      logApiRequestSuccess(logContext, 409, { reason: "stock_conflict" })
      return withRequestId(response, logContext.requestId)
    }
    logApiRequestError(logContext, error, 400)
    const response = NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create booking order." },
      { status: 400 }
    )
    return withRequestId(response, logContext.requestId)
  }
}
