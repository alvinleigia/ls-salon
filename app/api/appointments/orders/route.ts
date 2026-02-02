import { AppointmentStatus, Prisma } from "@prisma/client"
import { NextResponse } from "next/server"
import { z } from "zod"

import { auth } from "@/auth"
import { checkStaffAppointmentAvailability } from "@/app/api/appointments/_availability"
import { prisma } from "@/lib/prisma"
import {
  calculateCouponDiscounts,
  calculateTaxBreakdown,
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
  lineSubtotalCents: number
  lineDiscountCents: number
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

  const normalizedTaxIds = [...new Set(input.taxIds)]
  const [customer, services, staffProfiles, couponsFromDb, taxesFromDb] = await Promise.all([
    prisma.user.findUnique({
      where: { id: input.customerId },
      select: { id: true, role: true, status: true },
    }),
    prisma.service.findMany({
      where: {
        id: { in: [...new Set(input.lines.map((line) => line.serviceId))] },
      },
      select: { id: true, durationMinutes: true, status: true },
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

    const amounts = calculateLineAmounts({
      quantity: line.quantity,
      unitPriceCents: line.unitPriceCents,
      discountType: line.discountType,
      discountValue: line.discountValue,
    })

    lines.push({
      serviceId: service.id,
      staffProfileId: staffProfile.id,
      quantity: line.quantity,
      durationMinutes: totalDurationMinutes,
      unitPriceCents: line.unitPriceCents,
      discountType: line.discountType,
      discountValue: line.discountValue,
      lineSubtotalCents: amounts.lineSubtotalCents,
      lineDiscountCents: amounts.lineDiscountCents,
      lineTotalCents: amounts.lineTotalCents,
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
  const coupons = calculateCouponDiscounts(subtotalCents - lineDiscountCents, couponRules)
  const couponDiscountCents = coupons.reduce((sum, coupon) => sum + coupon.discountCents, 0)
  const discountedSubtotal = Math.max(0, subtotalCents - lineDiscountCents - couponDiscountCents)
  const selectedTaxes = normalizedTaxIds
    .map((taxId) => taxesFromDb.find((tax) => tax.id === taxId))
    .filter((tax): tax is { id: string; name: string; percent: number } => Boolean(tax))
  const taxes: ResolvedOrderTax[] = calculateTaxBreakdown(
    discountedSubtotal,
    selectedTaxes.map((tax) => ({
      id: tax.id,
      name: tax.name,
      percent: tax.percent,
    }))
  ).map((tax) => ({
    taxId: tax.id,
    name: tax.name,
    percent: tax.percent,
    taxCents: tax.taxCents,
  }))
  const taxCents = taxes.reduce((sum, tax) => sum + tax.taxCents, 0)
  const totalCents = Math.max(0, discountedSubtotal + taxCents)

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

const assertConfirmAvailability = async (
  orderLines: ResolvedOrderLine[],
  customerId: string
) => {
  for (const line of orderLines) {
    const availability = await checkStaffAppointmentAvailability(
      line.staffProfileId,
      line.startAt,
      line.endAt
    )
    if (!availability.ok) {
      throw new Error(availability.reason || "Staff is unavailable for one of the selected slots.")
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
      throw new Error("A staff member has a conflicting appointment.")
    }
    if (customerConflict) {
      throw new Error("Customer has a conflicting appointment.")
    }
  }
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
    if (resolved.status === "CONFIRMED") {
      await assertConfirmAvailability(resolved.lines, resolved.customerId)
    }

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
            create: resolved.lines.map((line) => ({
              serviceId: line.serviceId,
              staffProfileId: line.staffProfileId,
              quantity: line.quantity,
              durationMinutes: line.durationMinutes,
              unitPriceCents: line.unitPriceCents,
              discountType: line.discountType,
              discountValue: line.discountValue,
              lineSubtotalCents: line.lineSubtotalCents,
              lineDiscountCents: line.lineDiscountCents,
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
        await tx.appointment.createMany({
          data: created.lines.map((line) => ({
            staffProfileId: line.staffProfileId,
            customerId: created.customerId,
            serviceId: line.serviceId,
            startAt: line.startAt,
            endAt: line.endAt,
            status: AppointmentStatus.SCHEDULED,
            orderLineId: line.id,
          })),
        })
      }

      return created
    })

    return NextResponse.json({ order: serializeAppointmentOrder(order) }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create booking order." },
      { status: 400 }
    )
  }
}
