import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { shiftOverrideSchema } from "@/lib/validation"
import { canManageUsers, type Role } from "@/lib/permissions"

const toISODate = (value: Date) => value.toISOString().slice(0, 10)

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
    select: {
      id: true,
      shiftSchedule: {
        select: {
          startDate: true,
          weekOffDay1: true,
          weekOffDay2: true,
          weekOff2Weeks: true,
        },
      },
    },
  })

  if (!staffProfile) {
    return NextResponse.json({ error: "Staff profile not found." }, { status: 404 })
  }

  const defaultSchedule = staffProfile.shiftSchedule
    ? null
    : await prisma.shiftSchedule.findFirst({
        where: { isDefault: true },
        select: {
          startDate: true,
          weekOffDay1: true,
          weekOffDay2: true,
          weekOff2Weeks: true,
        },
      })

  const schedule = staffProfile.shiftSchedule ?? defaultSchedule
  const weekOff2Weeks =
    schedule?.weekOffDay2 && (!schedule?.weekOff2Weeks || schedule.weekOff2Weeks.length === 0)
      ? [1, 2, 3, 4, 5]
      : schedule?.weekOff2Weeks ?? []

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

  const isWeekOff = (value: Date) => {
    if (!schedule || !data.skipWeekOff) return false
    const weekday = resolveWeekday(value)
    if (weekday === schedule.weekOffDay1) return true
    if (schedule.weekOffDay2 && weekday === schedule.weekOffDay2) {
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

  const results = await prisma.$transaction(
    dates
      .filter((value) => {
        if (data.skipHolidays && holidaySet.has(toISODate(value))) return false
        if (isWeekOff(value)) return false
        return true
      })
      .map((value) =>
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

  return NextResponse.json({ deletedCount: result.count })
}
