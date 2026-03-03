import { Weekday, type Prisma, type PrismaClient, type StaffRosterDaySource } from "@prisma/client"

type DbClient = PrismaClient | Prisma.TransactionClient

type RosterHistoryDelegate = {
  upsert: (args: unknown) => Promise<unknown>
  findMany: (args: unknown) => Promise<Array<{ staffProfileId: string; date: Date }>>
  createMany: (args: unknown) => Promise<unknown>
}

type ShiftTemplateWithBreaks = {
  id: string
  name: string
  startTime: string
  endTime: string
  breaks: { startTime: string; endTime: string }[]
}

type BuildRosterHistoryParams = {
  staffProfileIds: string[]
  startDate: string
  endDate: string
  tenantId?: string
}

type SyncMode = "insert-missing" | "replace"

type SyncRosterHistoryParams = BuildRosterHistoryParams & {
  mode?: SyncMode
}

const parseDateOnly = (value: string) => {
  const [year, month, day] = value.split("-").map((chunk) => Number(chunk))
  if (!year || !month || !day) {
    return null
  }
  const parsed = new Date(year, month - 1, day)
  parsed.setHours(0, 0, 0, 0)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const toDateKey = (value: Date) => {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, "0")
  const day = String(value.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

const enumerateDates = (startDate: Date, endDate: Date) => {
  const dates: Date[] = []
  const cursor = new Date(startDate)
  while (cursor <= endDate) {
    dates.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
}

const parseMinutes = (value: string) => {
  const [hours, minutes] = value.split(":").map((part) => Number(part))
  return (Number.isNaN(hours) ? 0 : hours) * 60 + (Number.isNaN(minutes) ? 0 : minutes)
}

const getPaidMinutes = (template: ShiftTemplateWithBreaks) => {
  const total = Math.max(0, parseMinutes(template.endTime) - parseMinutes(template.startTime))
  const breakMinutes = (template.breaks ?? []).reduce((sum, period) => {
    const minutes = Math.max(0, parseMinutes(period.endTime) - parseMinutes(period.startTime))
    return sum + minutes
  }, 0)
  return Math.max(0, total - breakMinutes)
}

const resolveWeekday = (value: Date): Weekday => {
  const mapping: Weekday[] = [
    Weekday.SUNDAY,
    Weekday.MONDAY,
    Weekday.TUESDAY,
    Weekday.WEDNESDAY,
    Weekday.THURSDAY,
    Weekday.FRIDAY,
    Weekday.SATURDAY,
  ]
  return mapping[value.getDay()] ?? Weekday.SUNDAY
}

const getWeekOfMonth = (value: Date) => Math.floor((value.getDate() - 1) / 7) + 1

const isWeekOff = (value: Date, schedule: { weekOffDay1: Weekday; weekOffDay2: Weekday | null; weekOff2Weeks: number[] }) => {
  const weekday = resolveWeekday(value)
  if (weekday === schedule.weekOffDay1) return true
  if (schedule.weekOffDay2 && weekday === schedule.weekOffDay2) {
    const weeks = schedule.weekOff2Weeks.length ? schedule.weekOff2Weeks : [1, 2, 3, 4, 5]
    return weeks.includes(getWeekOfMonth(value))
  }
  return false
}

const buildScheduleTemplateMap = (
  schedule: {
    startDate: Date
    weekOffDay1: Weekday
    weekOffDay2: Weekday | null
    weekOff2Weeks: number[]
    blocks: { repeatDays: number; sortOrder: number; template: ShiftTemplateWithBreaks }[]
  },
  rangeStart: Date,
  rangeEnd: Date,
  startOverride?: Date,
  endOverride?: Date | null
) => {
  const map: Record<string, ShiftTemplateWithBreaks | null> = {}
  const blocks = [...(schedule.blocks ?? [])].sort((a, b) => a.sortOrder - b.sortOrder)
  if (!blocks.length) {
    return map
  }

  const effectiveStart = startOverride ?? schedule.startDate
  const effectiveEnd = endOverride ?? rangeEnd
  if (effectiveStart > rangeEnd || effectiveEnd < rangeStart) {
    return map
  }

  let blockIndex = 0
  let dayInBlock = 0
  const cursor = new Date(effectiveStart)
  cursor.setHours(0, 0, 0, 0)

  while (cursor <= effectiveEnd) {
    const dateKey = toDateKey(cursor)
    if (isWeekOff(cursor, schedule)) {
      if (cursor >= rangeStart && cursor <= rangeEnd) {
        map[dateKey] = null
      }
      cursor.setDate(cursor.getDate() + 1)
      continue
    }

    const block = blocks[blockIndex]
    if (cursor >= rangeStart && cursor <= rangeEnd) {
      map[dateKey] = block?.template ?? null
    }
    dayInBlock += 1
    if (block && dayInBlock >= block.repeatDays) {
      blockIndex += 1
      dayInBlock = 0
      if (blockIndex >= blocks.length) {
        blockIndex = 0
      }
    }
    cursor.setDate(cursor.getDate() + 1)
  }

  return map
}

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

const getYesterday = (timeZone?: string | null) => {
  if (timeZone) {
    const todayKey = getDateKeyInTimeZone(new Date(), timeZone)
    const todayInTz = parseDateOnly(todayKey)
    if (todayInTz) {
      todayInTz.setDate(todayInTz.getDate() - 1)
      return todayInTz
    }
  }
  const value = new Date()
  value.setHours(0, 0, 0, 0)
  value.setDate(value.getDate() - 1)
  return value
}

const buildRosterHistoryRows = async (
  tx: DbClient,
  params: BuildRosterHistoryParams
) => {
  const uniqueStaffIds = Array.from(new Set(params.staffProfileIds.filter(Boolean)))
  if (!uniqueStaffIds.length) {
    return []
  }

  const parsedStart = parseDateOnly(params.startDate)
  const parsedEnd = parseDateOnly(params.endDate)
  if (!parsedStart || !parsedEnd || parsedStart > parsedEnd) {
    return []
  }

  const dates = enumerateDates(parsedStart, parsedEnd)
  const staffSet = new Set(uniqueStaffIds)
  const [assignments, defaultSchedule, overrides, leaves, staffProfiles, flexibleSlots] = await Promise.all([
    tx.staffScheduleAssignment.findMany({
      where: {
        staffProfileId: { in: uniqueStaffIds },
        startDate: { lte: parsedEnd },
        OR: [{ endDate: null }, { endDate: { gte: parsedStart } }],
      },
      include: {
        schedule: {
          include: {
            blocks: {
              orderBy: { sortOrder: "asc" },
              include: {
                template: {
                  include: { breaks: { orderBy: { sortOrder: "asc" } } },
                },
              },
            },
          },
        },
      },
      orderBy: { startDate: "asc" },
    }),
    tx.shiftSchedule.findFirst({
      where: {
        isDefault: true,
        ...(params.tenantId ? { tenantId: params.tenantId } : {}),
      },
      include: {
        blocks: {
          orderBy: { sortOrder: "asc" },
          include: {
            template: {
              include: { breaks: { orderBy: { sortOrder: "asc" } } },
            },
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }],
    }),
    tx.staffShiftOverride.findMany({
      where: {
        staffProfileId: { in: uniqueStaffIds },
        date: { gte: parsedStart, lte: parsedEnd },
      },
      include: {
        template: {
          include: { breaks: { orderBy: { sortOrder: "asc" } } },
        },
      },
    }),
    tx.leaveRequest.findMany({
      where: {
        staffProfileId: { in: uniqueStaffIds },
        status: "APPROVED",
        startDate: { lte: parsedEnd },
        endDate: { gte: parsedStart },
      },
      include: {
        leaveDefinition: { select: { code: true, name: true } },
      },
      orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
    }),
    tx.staffProfile.findMany({
      where: { id: { in: uniqueStaffIds } },
      select: { id: true, schedulingMode: true },
    }),
    tx.staffFlexibleAvailability.findMany({
      where: {
        staffProfileId: { in: uniqueStaffIds },
        date: { gte: parsedStart, lte: parsedEnd },
      },
      orderBy: [{ date: "asc" }, { sortOrder: "asc" }],
      select: {
        staffProfileId: true,
        date: true,
        startTime: true,
        endTime: true,
      },
    }),
  ])

  const assignmentByStaff = new Map<string, typeof assignments>()
  for (const assignment of assignments) {
    const existing = assignmentByStaff.get(assignment.staffProfileId) ?? []
    existing.push(assignment)
    assignmentByStaff.set(assignment.staffProfileId, existing)
  }

  const overrideMap = new Map<string, typeof overrides[number]>()
  for (const override of overrides) {
    overrideMap.set(`${override.staffProfileId}:${toDateKey(override.date)}`, override)
  }

  const leaveMap = new Map<string, typeof leaves[number]>()
  for (const leave of leaves) {
    const start = new Date(leave.startDate)
    start.setHours(0, 0, 0, 0)
    const end = new Date(leave.endDate)
    end.setHours(0, 0, 0, 0)
    const cursor = new Date(start)
    while (cursor <= end) {
      const key = `${leave.staffProfileId}:${toDateKey(cursor)}`
      if (!leaveMap.has(key)) {
        leaveMap.set(key, leave)
      }
      cursor.setDate(cursor.getDate() + 1)
    }
  }

  const schedulingModeByStaff = new Map(staffProfiles.map((item) => [item.id, item.schedulingMode]))

  const flexibleSlotMap = new Map<
    string,
    Array<{ startTime: string; endTime: string }>
  >()
  for (const slot of flexibleSlots) {
    const key = `${slot.staffProfileId}:${toDateKey(slot.date)}`
    const existing = flexibleSlotMap.get(key) ?? []
    existing.push({ startTime: slot.startTime, endTime: slot.endTime })
    flexibleSlotMap.set(key, existing)
  }

  const rows: {
    staffProfileId: string
    date: Date
    source: StaffRosterDaySource
    templateId: string | null
    templateName: string | null
    startTime: string | null
    endTime: string | null
    paidMinutes: number
    leaveRequestId: string | null
    leaveDefinitionCode: string | null
    leaveDefinitionName: string | null
    leaveReason: string | null
  }[] = []

  for (const staffProfileId of uniqueStaffIds) {
    if (!staffSet.has(staffProfileId)) continue
    const baseTemplateMap: Record<string, ShiftTemplateWithBreaks | null> = {}
    const staffAssignments = assignmentByStaff.get(staffProfileId) ?? []
    for (const assignment of staffAssignments) {
      const partial = buildScheduleTemplateMap(
        assignment.schedule,
        parsedStart,
        parsedEnd,
        assignment.startDate,
        assignment.endDate
      )
      Object.assign(baseTemplateMap, partial)
    }
    if (!staffAssignments.length && defaultSchedule) {
      Object.assign(
        baseTemplateMap,
        buildScheduleTemplateMap(defaultSchedule, parsedStart, parsedEnd)
      )
    }

    for (const day of dates) {
      const dateKey = toDateKey(day)
      const leave = leaveMap.get(`${staffProfileId}:${dateKey}`)
      if (leave) {
        rows.push({
          staffProfileId,
          date: new Date(day),
          source: "LEAVE",
          templateId: null,
          templateName: null,
          startTime: null,
          endTime: null,
          paidMinutes: 0,
          leaveRequestId: leave.id,
          leaveDefinitionCode: leave.leaveDefinition.code,
          leaveDefinitionName: leave.leaveDefinition.name,
          leaveReason: leave.reason ?? null,
        })
        continue
      }

      const override = overrideMap.get(`${staffProfileId}:${dateKey}`)
      if (override) {
        if (!override.template) {
          rows.push({
            staffProfileId,
            date: new Date(day),
            source: "UNAVAILABLE",
            templateId: null,
            templateName: null,
            startTime: null,
            endTime: null,
            paidMinutes: 0,
            leaveRequestId: null,
            leaveDefinitionCode: null,
            leaveDefinitionName: null,
            leaveReason: null,
          })
          continue
        }
        rows.push({
          staffProfileId,
          date: new Date(day),
          source: "OVERRIDE",
          templateId: override.template.id,
          templateName: override.template.name,
          startTime: override.template.startTime,
          endTime: override.template.endTime,
          paidMinutes: getPaidMinutes(override.template),
          leaveRequestId: null,
          leaveDefinitionCode: null,
          leaveDefinitionName: null,
          leaveReason: null,
        })
        continue
      }

      const template = baseTemplateMap[dateKey] ?? null
      if (schedulingModeByStaff.get(staffProfileId) === "FLEXIBLE") {
        const slots = flexibleSlotMap.get(`${staffProfileId}:${dateKey}`) ?? []
        if (!slots.length) {
          rows.push({
            staffProfileId,
            date: new Date(day),
            source: "OFF",
            templateId: null,
            templateName: null,
            startTime: null,
            endTime: null,
            paidMinutes: 0,
            leaveRequestId: null,
            leaveDefinitionCode: null,
            leaveDefinitionName: null,
            leaveReason: null,
          })
          continue
        }
        const sortedSlots = [...slots].sort(
          (a, b) => parseMinutes(a.startTime) - parseMinutes(b.startTime)
        )
        const paidMinutes = sortedSlots.reduce(
          (sum, slot) => sum + Math.max(0, parseMinutes(slot.endTime) - parseMinutes(slot.startTime)),
          0
        )
        rows.push({
          staffProfileId,
          date: new Date(day),
          source: "SCHEDULE",
          templateId: null,
          templateName: "Flexible",
          startTime: sortedSlots[0]?.startTime ?? null,
          endTime: sortedSlots[sortedSlots.length - 1]?.endTime ?? null,
          paidMinutes,
          leaveRequestId: null,
          leaveDefinitionCode: null,
          leaveDefinitionName: null,
          leaveReason: null,
        })
        continue
      }
      if (!template) {
        rows.push({
          staffProfileId,
          date: new Date(day),
          source: "OFF",
          templateId: null,
          templateName: null,
          startTime: null,
          endTime: null,
          paidMinutes: 0,
          leaveRequestId: null,
          leaveDefinitionCode: null,
          leaveDefinitionName: null,
          leaveReason: null,
        })
        continue
      }

      rows.push({
        staffProfileId,
        date: new Date(day),
        source: "SCHEDULE",
        templateId: template.id,
        templateName: template.name,
        startTime: template.startTime,
        endTime: template.endTime,
        paidMinutes: getPaidMinutes(template),
        leaveRequestId: null,
        leaveDefinitionCode: null,
        leaveDefinitionName: null,
        leaveReason: null,
      })
    }
  }

  return rows
}

export const syncRosterHistoryRange = async (
  tx: DbClient,
  params: SyncRosterHistoryParams
) => {
  const rosterHistoryDelegate = (
    tx as { staffRosterHistoryDay?: RosterHistoryDelegate }
  ).staffRosterHistoryDay
  if (!rosterHistoryDelegate) {
    return 0
  }
  const mode = params.mode ?? "insert-missing"
  const rows = await buildRosterHistoryRows(tx, params)
  if (!rows.length) return 0

  if (mode === "replace") {
    await Promise.all(
      rows.map((row) =>
        rosterHistoryDelegate.upsert({
          where: {
            staffProfileId_date: {
              staffProfileId: row.staffProfileId,
              date: row.date,
            },
          },
          update: {
            source: row.source,
            templateId: row.templateId,
            templateName: row.templateName,
            startTime: row.startTime,
            endTime: row.endTime,
            paidMinutes: row.paidMinutes,
            leaveRequestId: row.leaveRequestId,
            leaveDefinitionCode: row.leaveDefinitionCode,
            leaveDefinitionName: row.leaveDefinitionName,
            leaveReason: row.leaveReason,
          },
          create: row,
        })
      )
    )
    return rows.length
  }

  const parsedStart = parseDateOnly(params.startDate)
  const parsedEnd = parseDateOnly(params.endDate)
  if (!parsedStart || !parsedEnd || parsedStart > parsedEnd) {
    return 0
  }

  const existing = await rosterHistoryDelegate.findMany({
    where: {
      staffProfileId: { in: params.staffProfileIds },
      date: { gte: parsedStart, lte: parsedEnd },
    },
    select: { staffProfileId: true, date: true },
  })
  const existingSet = new Set(existing.map((item) => `${item.staffProfileId}:${toDateKey(item.date)}`))
  const inserts = rows.filter(
    (row) => !existingSet.has(`${row.staffProfileId}:${toDateKey(row.date)}`)
  )
  if (!inserts.length) {
    return 0
  }
  await rosterHistoryDelegate.createMany({
    data: inserts,
    skipDuplicates: true,
  })
  return inserts.length
}

export const captureRosterHistoryUpToYesterday = async (
  tx: DbClient,
  params: { staffProfileIds: string[]; startDate?: string | null; timeZone?: string | null; tenantId?: string }
) => {
  const yesterday = getYesterday(params.timeZone)
  const endDate = toDateKey(yesterday)
  const startDate = params.startDate ?? endDate
  const parsedStart = parseDateOnly(startDate)
  const parsedEnd = parseDateOnly(endDate)
  if (!parsedStart || !parsedEnd || parsedStart > parsedEnd) {
    return 0
  }
  return syncRosterHistoryRange(tx, {
    staffProfileIds: params.staffProfileIds,
    startDate: toDateKey(parsedStart),
    endDate,
    mode: "insert-missing",
    tenantId: params.tenantId,
  })
}

export const normalizeHistoryRangeToPast = (
  startDate: string,
  endDate: string,
  timeZone?: string | null
) => {
  const parsedStart = parseDateOnly(startDate)
  const parsedEnd = parseDateOnly(endDate)
  if (!parsedStart || !parsedEnd || parsedStart > parsedEnd) {
    return null
  }
  const yesterday = getYesterday(timeZone)
  if (parsedStart > yesterday) {
    return null
  }
  const boundedEnd = parsedEnd > yesterday ? yesterday : parsedEnd
  return {
    startDate: toDateKey(parsedStart),
    endDate: toDateKey(boundedEnd),
  }
}
