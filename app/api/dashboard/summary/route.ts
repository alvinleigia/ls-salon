import { NextResponse } from "next/server"
import { AppointmentOrderStatus, AppointmentStatus, Role, UserStatus } from "@prisma/client"

import {
  createApiLogContext,
  logApiRequestError,
  logApiRequestStart,
  logApiRequestSuccess,
  withRequestId,
} from "@/lib/api-logging"
import { prisma } from "@/lib/prisma"
import { requireTenantSession } from "@/lib/tenant-auth"

const BOOKING_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.SCHEDULED,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.IN_PROGRESS,
  AppointmentStatus.COMPLETED,
]

const REVENUE_STATUSES: AppointmentOrderStatus[] = [
  AppointmentOrderStatus.CONFIRMED,
  AppointmentOrderStatus.COMPLETED,
]

const firstDayIndexMap = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
} as const

const startOfDay = (value: Date) => {
  const next = new Date(value)
  next.setHours(0, 0, 0, 0)
  return next
}

const addDays = (value: Date, days: number) => {
  const next = new Date(value)
  next.setDate(next.getDate() + days)
  return next
}

const parseDateOnly = (value: string | null) => {
  if (!value) return null
  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

const toDateKey = (value: Date) => value.toISOString().slice(0, 10)

const toDateLabel = (value: Date) =>
  value.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })

const getRangeBounds = (
  range: string,
  firstDayOfWeek: keyof typeof firstDayIndexMap,
  startDateRaw: string | null,
  endDateRaw: string | null
) => {
  const now = new Date()
  const today = startOfDay(now)

  if (range === "today") {
    const endExclusive = addDays(today, 1)
    return { label: "Today", start: today, endExclusive }
  }

  if (range === "month") {
    const start = new Date(today.getFullYear(), today.getMonth(), 1)
    const endExclusive = new Date(today.getFullYear(), today.getMonth() + 1, 1)
    return { label: "This month", start, endExclusive }
  }

  if (range === "custom") {
    const parsedStart = parseDateOnly(startDateRaw)
    const parsedEnd = parseDateOnly(endDateRaw)
    if (parsedStart && parsedEnd && parsedStart <= parsedEnd) {
      return {
        label: "Custom range",
        start: parsedStart,
        endExclusive: addDays(parsedEnd, 1),
      }
    }
  }

  const firstIndex = firstDayIndexMap[firstDayOfWeek] ?? 0
  const currentIndex = today.getDay()
  const diff = (currentIndex - firstIndex + 7) % 7
  const start = addDays(today, -diff)
  return {
    label: "This week",
    start,
    endExclusive: addDays(start, 7),
  }
}

export async function GET(request: Request) {
  const logContext = createApiLogContext(request)
  logApiRequestStart(logContext, request)

  const authorized = await requireTenantSession(request)
  if (authorized.error) {
    logApiRequestSuccess(logContext, authorized.error.status, { reason: "unauthorized_or_invalid_tenant" })
    return withRequestId(authorized.error, logContext.requestId)
  }

  const { tenantId } = authorized.context

  try {
    const url = new URL(request.url)
    const range = (url.searchParams.get("range") || "week").toLowerCase()
    const startDateRaw = url.searchParams.get("startDate")
    const endDateRaw = url.searchParams.get("endDate")

    const settings = await prisma.appSetting.findUnique({
      where: { tenantId },
      select: { firstDayOfWeek: true },
    })

    const bounds = getRangeBounds(
      range,
      (settings?.firstDayOfWeek ?? "SUNDAY") as keyof typeof firstDayIndexMap,
      startDateRaw,
      endDateRaw
    )

    const today = startOfDay(new Date())
    const tomorrow = addDays(today, 1)
    const periodStartDateOnly = startOfDay(bounds.start)
    const periodEndDateOnly = addDays(startOfDay(bounds.endExclusive), -1)

    const [
      periodOrders,
      todayOrders,
      periodAppointments,
      todayAppointments,
      distinctCustomers,
      pendingLeaves,
      activeServices,
      activeStaff,
      upcomingAppointments,
      lowStockProducts,
      appointmentStatusRows,
      topServiceLines,
      staffTodayAppointments,
    ] = await Promise.all([
      prisma.appointmentOrder.findMany({
        where: {
          tenantId,
          status: { in: REVENUE_STATUSES },
          appointmentDate: {
            gte: periodStartDateOnly,
            lte: periodEndDateOnly,
          },
        },
        select: {
          id: true,
          appointmentDate: true,
          totalCents: true,
        },
      }),
      prisma.appointmentOrder.findMany({
        where: {
          tenantId,
          status: { in: REVENUE_STATUSES },
          appointmentDate: { gte: today, lte: today },
        },
        select: { totalCents: true },
      }),
      prisma.appointment.findMany({
        where: {
          tenantId,
          startAt: { gte: bounds.start, lt: bounds.endExclusive },
          status: { in: BOOKING_STATUSES },
        },
        select: { id: true, startAt: true, status: true, customerId: true },
      }),
      prisma.appointment.findMany({
        where: {
          tenantId,
          startAt: { gte: today, lt: tomorrow },
          status: { in: BOOKING_STATUSES },
        },
        select: {
          id: true,
          staffProfileId: true,
          startAt: true,
          endAt: true,
        },
      }),
      prisma.appointment.findMany({
        where: {
          tenantId,
          startAt: { gte: bounds.start, lt: bounds.endExclusive },
          status: { in: BOOKING_STATUSES },
        },
        distinct: ["customerId"],
        select: { customerId: true },
      }),
      prisma.leaveRequest.count({
        where: {
          tenantId,
          status: "PENDING",
        },
      }),
      prisma.service.count({
        where: {
          tenantId,
          status: "ACTIVE",
        },
      }),
      prisma.user.count({
        where: {
          tenantId,
          role: Role.STAFF,
          status: UserStatus.ACTIVE,
        },
      }),
      prisma.appointment.findMany({
        where: {
          tenantId,
          startAt: { gte: new Date() },
          status: {
            in: [
              AppointmentStatus.SCHEDULED,
              AppointmentStatus.CONFIRMED,
              AppointmentStatus.IN_PROGRESS,
            ],
          },
        },
        orderBy: { startAt: "asc" },
        take: 8,
        select: {
          id: true,
          startAt: true,
          status: true,
          customer: { select: { name: true } },
          service: { select: { name: true, priceCents: true } },
          staffProfile: { select: { user: { select: { name: true } } } },
        },
      }),
      prisma.inventoryProduct.findMany({
        where: {
          tenantId,
          status: "ACTIVE",
          onHandQty: { lte: prisma.inventoryProduct.fields.reorderPoint },
        },
        orderBy: [{ onHandQty: "asc" }, { updatedAt: "desc" }],
        take: 8,
        select: {
          id: true,
          sku: true,
          name: true,
          onHandQty: true,
          reorderPoint: true,
          reorderQty: true,
          category: { select: { name: true } },
        },
      }),
      prisma.appointment.groupBy({
        by: ["status"],
        where: {
          tenantId,
          startAt: { gte: bounds.start, lt: bounds.endExclusive },
        },
        _count: { _all: true },
      }),
      prisma.appointmentOrderLine.findMany({
        where: {
          order: {
            tenantId,
            status: { in: REVENUE_STATUSES },
            appointmentDate: {
              gte: periodStartDateOnly,
              lte: periodEndDateOnly,
            },
          },
        },
        select: {
          serviceId: true,
          lineTotalCents: true,
          service: { select: { name: true } },
        },
      }),
      prisma.appointment.findMany({
        where: {
          tenantId,
          startAt: { gte: today, lt: tomorrow },
          status: { in: BOOKING_STATUSES },
        },
        select: {
          staffProfileId: true,
          startAt: true,
          endAt: true,
          staffProfile: { select: { user: { select: { name: true } } } },
        },
      }),
    ])

    const daySeriesMap = new Map<string, { date: string; label: string; revenueCents: number; bookings: number }>()
    for (let cursor = new Date(bounds.start); cursor < bounds.endExclusive; cursor = addDays(cursor, 1)) {
      const key = toDateKey(cursor)
      daySeriesMap.set(key, {
        date: key,
        label: toDateLabel(cursor),
        revenueCents: 0,
        bookings: 0,
      })
    }

    for (const order of periodOrders) {
      const key = toDateKey(order.appointmentDate)
      const point = daySeriesMap.get(key)
      if (!point) continue
      point.revenueCents += order.totalCents
    }

    for (const appointment of periodAppointments) {
      const key = toDateKey(appointment.startAt)
      const point = daySeriesMap.get(key)
      if (!point) continue
      point.bookings += 1
    }

    const topServiceMap = new Map<string, { serviceId: string; name: string; bookings: number; revenueCents: number }>()
    for (const line of topServiceLines) {
      const key = line.serviceId
      const current = topServiceMap.get(key) ?? {
        serviceId: line.serviceId,
        name: line.service?.name ?? "Unknown service",
        bookings: 0,
        revenueCents: 0,
      }
      current.bookings += 1
      current.revenueCents += line.lineTotalCents
      topServiceMap.set(key, current)
    }

    const staffMap = new Map<string, { staffProfileId: string; name: string; bookings: number; bookedMinutes: number }>()
    for (const row of staffTodayAppointments) {
      const key = row.staffProfileId
      const current = staffMap.get(key) ?? {
        staffProfileId: key,
        name: row.staffProfile.user.name?.trim() || "Staff",
        bookings: 0,
        bookedMinutes: 0,
      }
      current.bookings += 1
      const minutes = Math.max(0, Math.round((row.endAt.getTime() - row.startAt.getTime()) / 60000))
      current.bookedMinutes += minutes
      staffMap.set(key, current)
    }

    const payload = {
      range: {
        label: bounds.label,
        startDate: toDateKey(bounds.start),
        endDate: toDateKey(addDays(bounds.endExclusive, -1)),
      },
      kpis: {
        revenueCents: periodOrders.reduce((sum, row) => sum + row.totalCents, 0),
        revenueTodayCents: todayOrders.reduce((sum, row) => sum + row.totalCents, 0),
        appointments: periodAppointments.length,
        appointmentsToday: todayAppointments.length,
        distinctCustomers: distinctCustomers.length,
        pendingLeaves,
        activeServices,
        activeStaff,
      },
      series: {
        daily: Array.from(daySeriesMap.values()),
      },
      appointmentStatus: appointmentStatusRows
        .map((row) => ({
          status: row.status,
          count: row._count._all,
        }))
        .sort((a, b) => b.count - a.count),
      topServices: Array.from(topServiceMap.values())
        .sort((a, b) => b.revenueCents - a.revenueCents)
        .slice(0, 6),
      staffUtilization: Array.from(staffMap.values())
        .map((row) => ({
          ...row,
          utilizationPercent: Math.min(100, Math.round((row.bookedMinutes / (8 * 60)) * 100)),
        }))
        .sort((a, b) => b.bookedMinutes - a.bookedMinutes)
        .slice(0, 6),
      upcomingAppointments: upcomingAppointments.map((row) => ({
        id: row.id,
        startAt: row.startAt.toISOString(),
        status: row.status,
        customerName: row.customer?.name?.trim() || "Customer",
        staffName: row.staffProfile.user.name?.trim() || "Staff",
        serviceName: row.service.name,
        priceCents: row.service.priceCents,
      })),
      lowStock: lowStockProducts.map((row) => ({
        id: row.id,
        sku: row.sku,
        name: row.name,
        categoryName: row.category.name,
        onHandQty: row.onHandQty,
        reorderPoint: row.reorderPoint,
        reorderQty: row.reorderQty,
      })),
      generatedAt: new Date().toISOString(),
    }

    const response = NextResponse.json(payload)
    logApiRequestSuccess(logContext, 200, {
      range: payload.range.label,
      points: payload.series.daily.length,
      upcomingCount: payload.upcomingAppointments.length,
    })
    return withRequestId(response, logContext.requestId)
  } catch (error) {
    logApiRequestError(logContext, error, 500)
    const response = NextResponse.json({ error: "Unable to load dashboard summary." }, { status: 500 })
    return withRequestId(response, logContext.requestId)
  }
}
