import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Weekday } from "@prisma/client"
import { appSettingsSchema } from "@/lib/validation"
import { canManageUsers, type Role } from "@/lib/permissions"

const SETTINGS_ID = "global"
const DEFAULT_PERIOD = {
  kind: "WORK" as const,
  startTime: "09:00",
  endTime: "18:00",
}
const DEFAULT_WORKING_HOURS: {
  day: Weekday
  isOpen: boolean
  periods: typeof DEFAULT_PERIOD[]
}[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
].map((day) => ({
  day: day as Weekday,
  isOpen: true,
  periods: [DEFAULT_PERIOD],
}))

export const dynamic = "force-dynamic"

const includeWorkingHours = {
  workingDays: {
    orderBy: { day: "asc" as const },
    include: { periods: { orderBy: { sortOrder: "asc" as const } } },
  },
  overrides: {
    orderBy: { date: "asc" as const },
    include: { periods: { orderBy: { sortOrder: "asc" as const } } },
  },
}

const mapSettingsResponse = (settings: {
  workingDays?: {
    id: string
    day: string
    isOpen: boolean
    periods: {
      id: string
      kind: string
      startTime: string
      endTime: string
      sortOrder: number
    }[]
  }[]
  overrides?: {
    id: string
    date: Date
    isOpen: boolean
    periods: {
      id: string
      kind: string
      startTime: string
      endTime: string
      sortOrder: number
    }[]
  }[]
  [key: string]: unknown
}) => {
  const { workingDays, overrides, ...rest } = settings
  return {
    ...rest,
    workingHours:
      workingDays?.map((day) => ({
        id: day.id,
        day: day.day,
        isOpen: day.isOpen,
        periods: day.periods.map((period) => ({
          id: period.id,
          kind: period.kind,
          startTime: period.startTime,
          endTime: period.endTime,
          sortOrder: period.sortOrder,
        })),
      })) ?? [],
    overrides:
      overrides?.map((override) => ({
        id: override.id,
        date: override.date instanceof Date
          ? override.date.toISOString().slice(0, 10)
          : String(override.date),
        isOpen: override.isOpen,
        periods: override.periods.map((period) => ({
          id: period.id,
          kind: period.kind,
          startTime: period.startTime,
          endTime: period.endTime,
          sortOrder: period.sortOrder,
        })),
      })) ?? [],
  }
}

const seedWorkingHours = async (settingId: string) => {
  await prisma.$transaction(async (tx) => {
    for (const day of DEFAULT_WORKING_HOURS) {
      const dayRecord = await tx.appSettingDay.upsert({
        where: { settingId_day: { settingId, day: day.day } },
        update: { isOpen: day.isOpen },
        create: {
          settingId,
          day: day.day,
          isOpen: day.isOpen,
        },
      })
      await tx.appSettingPeriod.deleteMany({ where: { dayId: dayRecord.id } })
      await tx.appSettingPeriod.createMany({
        data: day.periods.map((period, index) => ({
          dayId: dayRecord.id,
          kind: period.kind,
          startTime: period.startTime,
          endTime: period.endTime,
          sortOrder: index,
        })),
      })
    }
  })
}

export async function GET() {
  const session = await auth()
  const role = (session?.user as { role?: string })?.role

  if (!session?.user || !canManageUsers(role as Role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const settings = await prisma.appSetting.findUnique({
    where: { id: SETTINGS_ID },
    include: includeWorkingHours,
  })

  if (settings) {
    if (settings.workingDays.length === 0) {
      await seedWorkingHours(SETTINGS_ID)
      const seeded = await prisma.appSetting.findUnique({
        where: { id: SETTINGS_ID },
        include: includeWorkingHours,
      })
      if (seeded) {
        return NextResponse.json({ settings: mapSettingsResponse(seeded) })
      }
      return NextResponse.json({ settings: mapSettingsResponse(settings) })
    }
    return NextResponse.json({ settings: mapSettingsResponse(settings) })
  }

  const created = await prisma.appSetting.create({
    data: { id: SETTINGS_ID },
  })

  await seedWorkingHours(SETTINGS_ID)
  const seeded = await prisma.appSetting.findUnique({
    where: { id: SETTINGS_ID },
    include: includeWorkingHours,
  })

  if (seeded) {
    return NextResponse.json({ settings: mapSettingsResponse(seeded) })
  }

  return NextResponse.json({ settings: created })
}

export async function PATCH(request: Request) {
  const session = await auth()
  const role = (session?.user as { role?: string })?.role

  if (!session?.user || !canManageUsers(role as Role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const parsed = appSettingsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { workingHours, overrides, ...baseSettings } = parsed.data

  await prisma.appSetting.upsert({
    where: { id: SETTINGS_ID },
    update: baseSettings,
    create: { id: SETTINGS_ID, ...baseSettings },
  })

  if (workingHours) {
    await prisma.$transaction(async (tx) => {
      for (const day of workingHours) {
        const dayRecord = await tx.appSettingDay.upsert({
          where: { settingId_day: { settingId: SETTINGS_ID, day: day.day } },
          update: { isOpen: day.isOpen },
          create: {
            settingId: SETTINGS_ID,
            day: day.day,
            isOpen: day.isOpen,
          },
        })
        await tx.appSettingPeriod.deleteMany({ where: { dayId: dayRecord.id } })
        if (day.periods.length) {
          await tx.appSettingPeriod.createMany({
            data: day.periods.map((period, index) => ({
              dayId: dayRecord.id,
              kind: period.kind,
              startTime: period.startTime,
              endTime: period.endTime,
              sortOrder: period.sortOrder ?? index,
            })),
          })
        }
      }
    })
  }

  if (overrides) {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.appSettingOverride.findMany({
        where: { settingId: SETTINGS_ID },
        select: { id: true, date: true },
      })
      const nextDates = new Set(
        overrides.map((override) => override.date)
      )
      const toRemove = existing.filter(
        (item) => !nextDates.has(item.date.toISOString().slice(0, 10))
      )
      if (toRemove.length) {
        await tx.appSettingOverridePeriod.deleteMany({
          where: { overrideId: { in: toRemove.map((item) => item.id) } },
        })
        await tx.appSettingOverride.deleteMany({
          where: { id: { in: toRemove.map((item) => item.id) } },
        })
      }

      for (const override of overrides) {
        const overrideDate = new Date(`${override.date}T00:00:00.000Z`)
        const overrideRecord = await tx.appSettingOverride.upsert({
          where: {
            settingId_date: { settingId: SETTINGS_ID, date: overrideDate },
          },
          update: { isOpen: override.isOpen },
          create: {
            settingId: SETTINGS_ID,
            date: overrideDate,
            isOpen: override.isOpen,
          },
        })
        await tx.appSettingOverridePeriod.deleteMany({
          where: { overrideId: overrideRecord.id },
        })
        if (override.periods.length) {
          await tx.appSettingOverridePeriod.createMany({
            data: override.periods.map((period, index) => ({
              overrideId: overrideRecord.id,
              kind: period.kind,
              startTime: period.startTime,
              endTime: period.endTime,
              sortOrder: period.sortOrder ?? index,
            })),
          })
        }
      }
    })
  }

  const settings = await prisma.appSetting.findUnique({
    where: { id: SETTINGS_ID },
    include: includeWorkingHours,
  })

  if (settings) {
    return NextResponse.json({ settings: mapSettingsResponse(settings) })
  }

  return NextResponse.json({ settings })
}
