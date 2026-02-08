import { AppointmentStatus, Prisma } from "@prisma/client"
import { NextResponse } from "next/server"
import { z } from "zod"

import { auth } from "@/auth"
import { checkStaffAppointmentAvailability } from "@/app/api/appointments/_availability"
import { prisma } from "@/lib/prisma"
import {
  calculateCouponDiscounts,
  calculateLineAmounts,
  pickActiveCouponRules,
  resolveCouponRules,
} from "@/lib/appointments/order-pricing"
import {
  appointmentOrderCreateSchema,
  type AppointmentOrderCreateInput,
} from "@/lib/validation"
import { canManageUsers, type Role } from "@/lib/permissions"
import type { ListResponse } from "@/types/api"
import type { AppointmentOrderRow } from "@/types/appointments"
import {
  appointmentOrderInclude,
  serializeAppointmentOrder,
  toDateOnlyUtc,
} from "./_helpers"

const ACTIVE_APPOINTMENT_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.SCHEDULED,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.IN_PROGRESS,
]

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["DRAFT", "CONFIRMED", "COMPLETED", "CANCELED"]).optional(),
  customerId: z.string().trim().optional(),
})

type ResolvedOrderLine = {
  serviceId: string
  staffProfileId: string
  quantity: number
  durationMinutes: number
  unitPriceCents: number
  discountType: AppointmentOrderCreateInput["lines"][number]["discountType"]
  discountValue: number
  taxMode: AppointmentOrderCreateInput["lines"][number]["taxMode"]
  taxIds: string[]
  taxPercents: Array<{ id: string; name: string; percent: number }>
  lineSubtotalCents: number
  lineDiscountCents: number
  lineTaxCents: number
  lineTotalCents: number
  startAt: Date
  endAt: Date
  note: string | null
  sortOrder: number
}

type ResolvedOrderTax = {
  taxId: string
  name: string
  percent: number
  taxCents: number
}

const sumPercent = (values: number[]) => values.reduce((sum, value) => sum + Math.max(0, value), 0)

const extractTaxFromInclusiveGross = (
  grossCents: number,
  taxes: Array<{ percent: number }>
) => {
  const totalPercent = sumPercent(taxes.map((tax) => tax.percent))
  if (grossCents <= 0 || totalPercent <= 0) return 0
  const netCents = Math.round((grossCents * 100) / (100 + totalPercent))
  return Math.max(0, grossCents - netCents)
}

const calculateExclusiveTaxFromNet = (
  netCents: number,
  taxes: Array<{ percent: number }>
) =>
  taxes.reduce(
    (sum, tax) =>
      sum + Math.max(0, Math.round((Math.max(0, netCents) * Math.max(0, tax.percent)) / 100)),
    0
  )

const allocateCouponByWeight = (amounts: number[], couponCents: number) => {
  const total = amounts.reduce((sum, value) => sum + Math.max(0, value), 0)
  if (total <= 0 || couponCents <= 0) return amounts.map(() => 0)

  const rawAllocations = amounts.map((value) => ({
    base: Math.floor((couponCents * Math.max(0, value)) / total),
    remainder: (couponCents * Math.max(0, value)) % total,
  }))
  let remaining = couponCents - rawAllocations.reduce((sum, item) => sum + item.base, 0)
  const ranked = rawAllocations
    .map((item, index) => ({ ...item, index }))
    .sort((a, b) => b.remainder - a.remainder)
  for (let i = 0; i < ranked.length && remaining > 0; i += 1) {
    rawAllocations[ranked[i].index].base += 1
    remaining -= 1
  }
  return rawAllocations.map((item) => item.base)
}

class AvailabilityConflictError extends Error {
  suggestedStartAt?: string

  constructor(message: string, suggestedStartAt?: Date) {
    super(message)
    this.name = "AvailabilityConflictError"
    this.suggestedStartAt = suggestedStartAt?.toISOString()
  }
}

const SUGGESTION_STEP_MINUTES = 15
const SUGGESTION_MAX_STEPS = 14 * 24 * (60 / SUGGESTION_STEP_MINUTES)

const ensureAuthorized = async () => {
  const session = await auth()
  const role = (session?.user as { role?: string })?.role
  if (!session?.user || !canManageUsers(role as Role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  return null
}

const resolveOrderData = async (input: AppointmentOrderCreateInput) => {
  const appointmentStartAt = new Date(input.appointmentStartAt)
  if (Number.isNaN(appointmentStartAt.getTime())) {
    throw new Error("Invalid appointment start date/time.")
  }
  if (appointmentStartAt <= new Date()) {
    throw new Error("Cannot create bookings in the past.")
  }

  const appointmentDate = toDateOnlyUtc(input.appointmentDate)
  const normalizedCouponCodes = resolveCouponRules(input.coupons)

  const normalizedTaxIds = [...new Set(input.lines.flatMap((line) => line.taxIds ?? []))]
  const [customer, services, staffProfiles, couponsFromDb, taxesFromDb] = await Promise.all([
    prisma.user.findUnique({
      where: { id: input.customerId },
      select: { id: true, role: true, status: true },
    }),
    prisma.service.findMany({
      where: {
        id: { in: [...new Set(input.lines.map((line) => line.serviceId))] },
      },
      select: {
        id: true,
        durationMinutes: true,
        priceCents: true,
        status: true,
        taxMode: true,
        defaultTaxes: { select: { taxId: true } },
      },
    }),
    prisma.staffProfile.findMany({
      where: {
        userId: { in: [...new Set(input.lines.map((line) => line.staffId))] },
      },
      select: {
        id: true,
        userId: true,
        user: { select: { role: true, status: true } },
      },
    }),
    normalizedCouponCodes.length
      ? prisma.coupon.findMany({
          where: {
            code: { in: normalizedCouponCodes },
            isActive: true,
            OR: [{ validFrom: null }, { validFrom: { lte: appointmentDate } }],
            AND: [{ OR: [{ validTo: null }, { validTo: { gte: appointmentDate } }] }],
          },
          select: {
            code: true,
            discountType: true,
            discountValue: true,
          },
        })
      : Promise.resolve([]),
    normalizedTaxIds.length
      ? prisma.tax.findMany({
          where: { id: { in: normalizedTaxIds }, isActive: true },
          select: { id: true, name: true, percent: true },
        })
      : Promise.resolve([]),
  ])

  if (!customer || customer.role !== "CUSTOMER") {
    throw new Error("Selected customer is invalid.")
  }
  if (customer.status !== "ACTIVE") {
    throw new Error("Customer is not active.")
  }

  const serviceMap = new Map(services.map((service) => [service.id, service]))
  const staffProfileMap = new Map(staffProfiles.map((staffProfile) => [staffProfile.userId, staffProfile]))

  const lines: ResolvedOrderLine[] = []
  let cursor = new Date(appointmentStartAt)

  input.lines.forEach((line, index) => {
    const service = serviceMap.get(line.serviceId)
    if (!service) {
      throw new Error(`Service not found for line ${index + 1}.`)
    }
    if (service.status !== "ACTIVE") {
      throw new Error(`Service is inactive for line ${index + 1}.`)
    }

    const staffProfile = staffProfileMap.get(line.staffId)
    if (!staffProfile || staffProfile.user.role !== "STAFF") {
      throw new Error(`Staff member not found for line ${index + 1}.`)
    }
    if (staffProfile.user.status !== "ACTIVE") {
      throw new Error(`Staff member is inactive for line ${index + 1}.`)
    }

    const totalDurationMinutes = service.durationMinutes * line.quantity
    const startAt = new Date(cursor)
    const endAt = new Date(cursor)
    endAt.setMinutes(endAt.getMinutes() + totalDurationMinutes)
    cursor = endAt

    const resolvedUnitPriceCents =
      line.unitPriceCents > 0 ? line.unitPriceCents : service.priceCents

    const amounts = calculateLineAmounts({
      quantity: line.quantity,
      unitPriceCents: resolvedUnitPriceCents,
      discountType: line.discountType,
      discountValue: line.discountValue,
    })
    const resolvedLineTaxIds = (line.taxIds ?? []).length
      ? line.taxIds
      : service.defaultTaxes.map((tax) => tax.taxId)
    const resolvedTaxMode = line.taxMode ?? service.taxMode
    const lineTaxes = resolvedLineTaxIds
      .map((taxId) => taxesFromDb.find((tax) => tax.id === taxId))
      .filter((tax): tax is { id: string; name: string; percent: number } => Boolean(tax))
    const lineTaxCents =
      resolvedTaxMode === "INCLUSIVE"
        ? extractTaxFromInclusiveGross(amounts.lineTotalCents, lineTaxes)
        : calculateExclusiveTaxFromNet(amounts.lineTotalCents, lineTaxes)
    const lineTotalCents =
      resolvedTaxMode === "INCLUSIVE"
        ? amounts.lineTotalCents
        : amounts.lineTotalCents + lineTaxCents

    lines.push({
      serviceId: service.id,
      staffProfileId: staffProfile.id,
      quantity: line.quantity,
      durationMinutes: totalDurationMinutes,
      unitPriceCents: resolvedUnitPriceCents,
      discountType: line.discountType,
      discountValue: line.discountValue,
      taxMode: resolvedTaxMode,
      taxIds: lineTaxes.map((tax) => tax.id),
      taxPercents: lineTaxes,
      lineSubtotalCents: amounts.lineSubtotalCents,
      lineDiscountCents: amounts.lineDiscountCents,
      lineTaxCents,
      lineTotalCents,
      startAt,
      endAt,
      note: line.note?.trim() || null,
      sortOrder: index,
    })
  })

  const subtotalCents = lines.reduce((sum, line) => sum + line.lineSubtotalCents, 0)
  const lineDiscountCents = lines.reduce((sum, line) => sum + line.lineDiscountCents, 0)
  const couponRules = pickActiveCouponRules(
    normalizedCouponCodes,
    couponsFromDb.map((coupon) => ({
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
    }))
  )
  const lineNetBeforeCoupon = lines.map((line) =>
    line.taxMode === "INCLUSIVE"
      ? Math.max(0, line.lineTotalCents - line.lineTaxCents)
      : Math.max(0, line.lineTotalCents - line.lineTaxCents)
  )
  const coupons = calculateCouponDiscounts(
    lineNetBeforeCoupon.reduce((sum, value) => sum + value, 0),
    couponRules
  )
  const couponDiscountCents = coupons.reduce((sum, coupon) => sum + coupon.discountCents, 0)
  const couponAllocations = allocateCouponByWeight(lineNetBeforeCoupon, couponDiscountCents)
  const lineTaxByLine = lines.map((line, index) => {
    const netAfterCoupon = Math.max(0, lineNetBeforeCoupon[index] - couponAllocations[index])
    return calculateExclusiveTaxFromNet(netAfterCoupon, line.taxPercents)
  })
  lines.forEach((line, index) => {
    const netAfterCoupon = Math.max(0, lineNetBeforeCoupon[index] - couponAllocations[index])
    const taxCentsForLine = lineTaxByLine[index]
    line.lineTaxCents = taxCentsForLine
    line.lineTotalCents = netAfterCoupon + taxCentsForLine
  })
  const taxBreakdownMap = new Map<string, ResolvedOrderTax>()
  lines.forEach((line, index) => {
    const netAfterCoupon = Math.max(0, lineNetBeforeCoupon[index] - couponAllocations[index])
    line.taxPercents.forEach((tax) => {
      const taxCents = Math.max(0, Math.round((Math.max(0, netAfterCoupon) * Math.max(0, tax.percent)) / 100))
      const current = taxBreakdownMap.get(tax.id)
      taxBreakdownMap.set(tax.id, {
        taxId: tax.id,
        name: tax.name,
        percent: tax.percent,
        taxCents: (current?.taxCents ?? 0) + taxCents,
      })
    })
  })
  const taxes = [...taxBreakdownMap.values()]
  const taxCents = taxes.reduce((sum, tax) => sum + tax.taxCents, 0)
  const totalCents = lines.reduce((sum, line) => sum + line.lineTotalCents, 0)

  return {
    appointmentDate,
    appointmentStartAt,
    lines,
    coupons,
    totals: {
      subtotalCents,
      lineDiscountCents,
      couponDiscountCents,
      taxCents,
      totalCents,
    },
    taxes,
    customerId: customer.id,
    status: input.status ?? "DRAFT",
    customerNote: input.customerNote?.trim() || null,
    internalNote: input.internalNote?.trim() || null,
  }
}

const getLineConflictReason = async (line: {
  staffProfileId: string
  startAt: Date
  endAt: Date
}, customerId: string) => {
  const availability = await checkStaffAppointmentAvailability(
    line.staffProfileId,
    line.startAt,
    line.endAt
  )
  if (!availability.ok) {
    return availability.reason || "Staff is unavailable for one of the selected slots."
  }

  const [staffConflict, customerConflict] = await Promise.all([
    prisma.appointment.findFirst({
      where: {
        staffProfileId: line.staffProfileId,
        status: { in: ACTIVE_APPOINTMENT_STATUSES },
        startAt: { lt: line.endAt },
        endAt: { gt: line.startAt },
      },
      select: { id: true },
    }),
    prisma.appointment.findFirst({
      where: {
        customerId,
        status: { in: ACTIVE_APPOINTMENT_STATUSES },
        startAt: { lt: line.endAt },
        endAt: { gt: line.startAt },
      },
      select: { id: true },
    }),
  ])

  if (staffConflict) {
    return "A staff member has a conflicting appointment."
  }
  if (customerConflict) {
    return "Customer has a conflicting appointment."
  }

  return null
}

const alignToStep = (value: Date) => {
  const next = new Date(value)
  next.setSeconds(0, 0)
  const remainder = next.getMinutes() % SUGGESTION_STEP_MINUTES
  if (remainder !== 0) {
    next.setMinutes(next.getMinutes() + (SUGGESTION_STEP_MINUTES - remainder))
  }
  return next
}

const findNextAvailableLineStart = async (
  line: ResolvedOrderLine,
  customerId: string,
  earliestStart: Date
) => {
  let candidate = alignToStep(earliestStart)

  for (let step = 0; step < SUGGESTION_MAX_STEPS; step += 1) {
    const startAt = new Date(candidate)
    const endAt = new Date(candidate)
    endAt.setMinutes(endAt.getMinutes() + line.durationMinutes)
    const reason = await getLineConflictReason(
      {
        staffProfileId: line.staffProfileId,
        startAt,
        endAt,
      },
      customerId
    )
    if (!reason) {
      return { startAt, endAt }
    }
    candidate = new Date(candidate.getTime() + SUGGESTION_STEP_MINUTES * 60_000)
  }

  return null
}

const scheduleConfirmedOrderLines = async (
  orderLines: ResolvedOrderLine[],
  customerId: string
) => {
  const scheduledLines: ResolvedOrderLine[] = []
  let cursor = orderLines[0]?.startAt ? new Date(orderLines[0].startAt) : new Date()

  for (let index = 0; index < orderLines.length; index += 1) {
    const line = orderLines[index]
    const lineStart = index === 0 ? new Date(line.startAt) : cursor
    const lineEnd = new Date(lineStart)
    lineEnd.setMinutes(lineEnd.getMinutes() + line.durationMinutes)

    if (index === 0) {
      const reason = await getLineConflictReason(
        {
          staffProfileId: line.staffProfileId,
          startAt: lineStart,
          endAt: lineEnd,
        },
        customerId
      )
      if (reason) {
        const suggestion = await findNextAvailableLineStart(
          line,
          customerId,
          new Date(lineStart.getTime() + SUGGESTION_STEP_MINUTES * 60_000)
        )
        throw new AvailabilityConflictError(reason, suggestion?.startAt)
      }
      scheduledLines.push({
        ...line,
        startAt: lineStart,
        endAt: lineEnd,
      })
      cursor = lineEnd
      continue
    }

    const nextSlot = await findNextAvailableLineStart(line, customerId, lineStart)
    if (!nextSlot) {
      throw new AvailabilityConflictError(
        `Unable to find an available slot for service item ${index + 1}.`
      )
    }

    scheduledLines.push({
      ...line,
      startAt: nextSlot.startAt,
      endAt: nextSlot.endAt,
    })
    cursor = nextSlot.endAt
  }

  return scheduledLines
}

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

  return NextResponse.json(response)
}

export async function POST(request: Request) {
  const unauthorized = await ensureAuthorized()
  if (unauthorized) return unauthorized

  const payload = await request.json()
  const parsed = appointmentOrderCreateSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  try {
    const resolved = await resolveOrderData(parsed.data)
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

      return created
    })

    return NextResponse.json({ order: serializeAppointmentOrder(order) }, { status: 201 })
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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create booking order." },
      { status: 400 }
    )
  }
}
