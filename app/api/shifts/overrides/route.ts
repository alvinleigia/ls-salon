import { NextResponse } from "next/server"

import { AppointmentStatus } from "@prisma/client"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import {
  normalizeHistoryRangeToPast,
  syncRosterHistoryRange,
} from "@/lib/roster-history"
import { shiftOverrideSchema } from "@/lib/validation"
import { canManageUsers, type Role } from "@/lib/permissions"

const toISODate = (value: Date) => value.toISOString().slice(0, 10)
const parseTimeToMinutes = (value: string) => {
  const [hours, minutes] = value.split(":").map((part) => Number(part))
  return (Number.isNaN(hours) ? 0 : hours) * 60 + (Number.isNaN(minutes) ? 0 : minutes)
}

const resolveWeekday = (value: Date) => {
  const mapping = [
    "SUNDAY",
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
  ] as const
  return mapping[value.getDay()] ?? "SUNDAY"
}

const getWeekOfMonth = (value: Date) => Math.floor((value.getDate() - 1) / 7) + 1

const getDateKeyInTimeZone = (value: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value)
  const year = parts.find((part) => part.type === "year")?.value ?? "0000"
  const month = parts.find((part) => part.type === "month")?.value ?? "01"
  const day = parts.find((part) => part.type === "day")?.value ?? "01"
  return `${year}-${month}-${day}`
}

const getMinutesInTimeZone = (value: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(value)
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0")
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0")
  return (Number.isNaN(hour) ? 0 : hour) * 60 + (Number.isNaN(minute) ? 0 : minute)
}

export async function GET(request: Request) {
  const session = await auth()
  const role = (session?.user as { role?: string })?.role

  if (!session?.user || !canManageUsers(role as Role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  const searchParams = url.searchParams
  const staffIdsParam = searchParams.get("staffIds")?.trim()
  const startDate = searchParams.get("startDate")?.trim()
  const endDate = searchParams.get("endDate")?.trim()

  if (!startDate || !endDate) {
    return NextResponse.json({ error: "Start and end dates are required." }, { status: 400 })
  }

  const staffIds = staffIdsParam
    ? staffIdsParam.split(",").map((value) => value.trim()).filter(Boolean)
    : []

  const staffProfiles = staffIds.length
    ? await prisma.staffProfile.findMany({
        where: { userId: { in: staffIds } },
        select: { id: true, userId: true },
      })
    : []

  const staffProfileIds = staffProfiles.map((profile) => profile.id)
  const staffProfileMap = new Map(staffProfiles.map((profile) => [profile.id, profile.userId]))

  const overrides = await prisma.staffShiftOverride.findMany({
    where: {
      ...(staffProfileIds.length ? { staffProfileId: { in: staffProfileIds } } : {}),
      date: {
        gte: new Date(startDate),
        lte: new Date(endDate),
      },
    },
    select: {
      id: true,
      staffProfileId: true,
      date: true,
      templateId: true,
      template: { select: { id: true, name: true, startTime: true, endTime: true } },
    },
  })

  const items = overrides.map((override) => ({
    ...override,
    staffId: staffProfileMap.get(override.staffProfileId) ?? null,
  }))

  return NextResponse.json({ items })
}

export async function POST(request: Request) {
  const session = await auth()
  const role = (session?.user as { role?: string })?.role

  if (!session?.user || !canManageUsers(role as Role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const parsed = shiftOverrideSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const data = parsed.data
  const start = new Date(data.startDate)
  const end = new Date(data.endDate)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return NextResponse.json({ error: "Invalid date range." }, { status: 400 })
  }

  const staffProfile = await prisma.staffProfile.findFirst({
    where: { userId: data.staffId },
    select: { id: true },
  })

  if (!staffProfile) {
    return NextResponse.json({ error: "Staff profile not found." }, { status: 404 })
  }

  const [defaultSchedule, assignments, settings] = await Promise.all([
    prisma.shiftSchedule.findFirst({
      where: { isDefault: true },
      select: {
        startDate: true,
        weekOffDay1: true,
        weekOffDay2: true,
        weekOff2Weeks: true,
      },
    }),
    prisma.staffScheduleAssignment.findMany({
      where: {
        staffProfileId: staffProfile.id,
        startDate: { lte: end },
        OR: [{ endDate: null }, { endDate: { gte: start } }],
      },
      include: {
        schedule: {
          select: {
            startDate: true,
            weekOffDay1: true,
            weekOffDay2: true,
            weekOff2Weeks: true,
          },
        },
      },
      orderBy: { startDate: "desc" },
    }),
    prisma.appSetting.findUnique({
      where: { id: "global" },
      select: { timeZone: true },
    }),
  ])
  const timeZone = settings?.timeZone ?? "UTC"

  const holidayOverrides = data.skipHolidays
    ? await prisma.appSettingOverride.findMany({
        where: {
          isOpen: false,
          date: {
            gte: new Date(data.startDate),
            lte: new Date(data.endDate),
          },
        },
        select: { date: true },
      })
    : []

  const holidaySet = new Set(holidayOverrides.map((override) => toISODate(override.date)))

  const resolveScheduleForDate = (value: Date) => {
    const match = assignments.find((assignment) => {
      if (assignment.startDate > value) return false
      if (assignment.endDate && assignment.endDate < value) return false
      return true
    })
    return match?.schedule ?? defaultSchedule ?? null
  }

  const isWeekOff = (value: Date) => {
    if (!data.skipWeekOff) return false
    const schedule = resolveScheduleForDate(value)
    if (!schedule) return false
    const weekday = resolveWeekday(value)
    if (weekday === schedule.weekOffDay1) return true
    if (schedule.weekOffDay2 && weekday === schedule.weekOffDay2) {
      const weekOff2Weeks =
        schedule.weekOffDay2 &&
        (!schedule.weekOff2Weeks || schedule.weekOff2Weeks.length === 0)
          ? [1, 2, 3, 4, 5]
          : schedule.weekOff2Weeks ?? []
      return weekOff2Weeks.includes(getWeekOfMonth(value))
    }
    return false
  }

  const dates: Date[] = []
  const cursor = new Date(start)
  while (cursor <= end) {
    dates.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }

  const targetDates = dates.filter((value) => {
    if (data.skipHolidays && holidaySet.has(toISODate(value))) return false
    if (isWeekOff(value)) return false
    return true
  })

  const template = data.isUnavailable
    ? null
    : data.templateId
      ? await prisma.shiftTemplate.findUnique({
          where: { id: data.templateId },
          include: { breaks: { orderBy: { sortOrder: "asc" } } },
        })
      : null

  const rangeStart = new Date(`${data.startDate}T00:00:00.000Z`)
  const rangeEnd = new Date(`${data.endDate}T23:59:59.999Z`)
  rangeStart.setDate(rangeStart.getDate() - 1)
  rangeEnd.setDate(rangeEnd.getDate() + 1)

  const appointments = await prisma.appointment.findMany({
    where: {
      staffProfileId: staffProfile.id,
      status: {
        in: [
          AppointmentStatus.SCHEDULED,
          AppointmentStatus.CONFIRMED,
          AppointmentStatus.IN_PROGRESS,
        ],
      },
      startAt: { gte: rangeStart, lte: rangeEnd },
    },
    include: {
      customer: { select: { id: true, name: true, email: true } },
      service: { select: { id: true, name: true, durationMinutes: true } },
    },
  })

  const appointmentByDate: Record<string, typeof appointments> = {}
  for (const appointment of appointments) {
    const key = getDateKeyInTimeZone(appointment.startAt, timeZone)
    if (!appointmentByDate[key]) {
      appointmentByDate[key] = []
    }
    appointmentByDate[key].push(appointment)
  }

  const conflicts: {
    id: string
    startAt: string
    endAt: string
    customerName?: string | null
    customerEmail?: string | null
    serviceName?: string | null
  }[] = []

  if (targetDates.length) {
    const shiftStart = template ? parseTimeToMinutes(template.startTime) : null
    const shiftEnd = template ? parseTimeToMinutes(template.endTime) : null
    const breaks = template?.breaks?.map((period) => ({
      start: parseTimeToMinutes(period.startTime),
      end: parseTimeToMinutes(period.endTime),
    })) ?? []

    for (const value of targetDates) {
      const key = getDateKeyInTimeZone(value, timeZone)
      const dayAppointments = appointmentByDate[key] ?? []
      if (!dayAppointments.length) continue

      for (const appointment of dayAppointments) {
        if (data.isUnavailable || !template || shiftStart === null || shiftEnd === null) {
          conflicts.push({
            id: appointment.id,
            startAt: appointment.startAt.toISOString(),
            endAt: appointment.endAt.toISOString(),
            customerName: appointment.customer?.name ?? null,
            customerEmail: appointment.customer?.email ?? null,
            serviceName: appointment.service?.name ?? null,
          })
          continue
        }

        const appointmentStart = getMinutesInTimeZone(appointment.startAt, timeZone)
        const appointmentEnd = getMinutesInTimeZone(appointment.endAt, timeZone)
        const outsideShift = appointmentStart < shiftStart || appointmentEnd > shiftEnd
        const overlapsBreak = breaks.some(
          (period) => appointmentStart < period.end && appointmentEnd > period.start
        )

        if (outsideShift || overlapsBreak) {
          conflicts.push({
            id: appointment.id,
            startAt: appointment.startAt.toISOString(),
            endAt: appointment.endAt.toISOString(),
            customerName: appointment.customer?.name ?? null,
            customerEmail: appointment.customer?.email ?? null,
            serviceName: appointment.service?.name ?? null,
          })
        }
      }
    }
  }

  if (conflicts.length) {
    return NextResponse.json(
      {
        error: "Shift change conflicts with existing appointments.",
        conflicts,
      },
      { status: 409 }
    )
  }

  const results = await prisma.$transaction(
    targetDates.map((value) =>
      prisma.staffShiftOverride.upsert({
        where: {
          staffProfileId_date: {
            staffProfileId: staffProfile.id,
            date: value,
          },
        },
        update: {
          templateId: data.isUnavailable ? null : data.templateId || null,
        },
        create: {
          staffProfileId: staffProfile.id,
          date: value,
          templateId: data.isUnavailable ? null : data.templateId || null,
        },
      })
    )
  )

  const normalizedPastRange = normalizeHistoryRangeToPast(data.startDate, data.endDate)
  if (normalizedPastRange) {
    await syncRosterHistoryRange(prisma, {
      staffProfileIds: [staffProfile.id],
      startDate: normalizedPastRange.startDate,
      endDate: normalizedPastRange.endDate,
      mode: "replace",
    })
  }

  return NextResponse.json({ createdCount: results.length })
}

export async function DELETE(request: Request) {
  const session = await auth()
  const role = (session?.user as { role?: string })?.role

  if (!session?.user || !canManageUsers(role as Role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await request.json()) as {
    staffId?: string
    startDate?: string
    endDate?: string
  }

  const staffId = body.staffId?.trim()
  const startDate = body.startDate?.trim()
  const endDate = body.endDate?.trim()

  if (!staffId || !startDate || !endDate) {
    return NextResponse.json(
      { error: "Staff, start date, and end date are required." },
      { status: 400 }
    )
  }

  const start = new Date(startDate)
  const end = new Date(endDate)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return NextResponse.json({ error: "Invalid date range." }, { status: 400 })
  }

  const staffProfile = await prisma.staffProfile.findFirst({
    where: { userId: staffId },
    select: { id: true },
  })

  if (!staffProfile) {
    return NextResponse.json({ error: "Staff profile not found." }, { status: 404 })
  }

  const result = await prisma.staffShiftOverride.deleteMany({
    where: {
      staffProfileId: staffProfile.id,
      date: {
        gte: start,
        lte: end,
      },
    },
  })

  const normalizedPastRange = normalizeHistoryRangeToPast(startDate, endDate)
  if (normalizedPastRange) {
    await syncRosterHistoryRange(prisma, {
      staffProfileIds: [staffProfile.id],
      startDate: normalizedPastRange.startDate,
      endDate: normalizedPastRange.endDate,
      mode: "replace",
    })
  }

  return NextResponse.json({ deletedCount: result.count })
}
