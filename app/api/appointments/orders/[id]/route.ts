import { AppointmentStatus } from "@prisma/client"
import { NextResponse } from "next/server"

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
  appointmentOrderUpdateSchema,
  type AppointmentOrderCreateInput,
} from "@/lib/validation"
import { canManageUsers, type Role } from "@/lib/permissions"
import {
  appointmentOrderInclude,
  serializeAppointmentOrder,
  toDateOnlyUtc,
} from "../_helpers"

const ACTIVE_APPOINTMENT_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.SCHEDULED,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.IN_PROGRESS,
]

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
  customerId: string,
  excludedAppointmentIds: string[]
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
          id: excludedAppointmentIds.length ? { notIn: excludedAppointmentIds } : undefined,
          staffProfileId: line.staffProfileId,
          status: { in: ACTIVE_APPOINTMENT_STATUSES },
          startAt: { lt: line.endAt },
          endAt: { gt: line.startAt },
        },
        select: { id: true },
      }),
      prisma.appointment.findFirst({
        where: {
          id: excludedAppointmentIds.length ? { notIn: excludedAppointmentIds } : undefined,
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
    taxIds: parsed.data.taxIds ?? currentOrder.taxes.map((tax) => tax.taxId).filter((taxId): taxId is string => Boolean(taxId)),
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
    const resolved = await resolveOrderData(nextInput)
    const existingAppointments = await prisma.appointment.findMany({
      where: { orderLine: { is: { orderId: id } } },
      select: { id: true },
    })
    const excludedIds = existingAppointments.map((item) => item.id)

    if (resolved.status === "CONFIRMED") {
      await assertConfirmAvailability(resolved.lines, resolved.customerId, excludedIds)
    }

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
        await tx.appointment.createMany({
          data: order.lines.map((line) => ({
            staffProfileId: line.staffProfileId,
            customerId: order.customerId,
            serviceId: line.serviceId,
            startAt: line.startAt,
            endAt: line.endAt,
            status: AppointmentStatus.SCHEDULED,
            orderLineId: line.id,
          })),
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

      return order
    })

    return NextResponse.json({ order: serializeAppointmentOrder(updated) })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update booking order." },
      { status: 400 }
    )
  }
}
