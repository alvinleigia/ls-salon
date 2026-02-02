import { prisma } from "@/lib/prisma"
import { toISODate } from "@/lib/date"
import type { ShiftSchedule, ShiftTemplateRow } from "@/types/shifts"

type ZonedDateParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
}

type AvailabilityCheckResult =
  | { ok: true; templateId: string }
  | { ok: false; reason: string }

const toMinutes = (value: string) => {
  const [hours, minutes] = value.split(":").map(Number)
  return (Number.isNaN(hours) ? 0 : hours) * 60 + (Number.isNaN(minutes) ? 0 : minutes)
}

const getWeekOfMonth = (value: Date) => Math.floor((value.getDate() - 1) / 7) + 1

const isScheduleWeekOff = (value: Date, schedule: ShiftSchedule) => {
  const mapping = [
    "SUNDAY",
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
  ] as const
  const weekday = mapping[value.getDay()]
  if (weekday === schedule.weekOffDay1) return true
  if (schedule.weekOffDay2 && weekday === schedule.weekOffDay2) {
    const weeks = schedule.weekOff2Weeks ?? []
    return weeks.includes(getWeekOfMonth(value))
  }
  return false
}

const resolveTemplateForScheduleDate = (schedule: ShiftSchedule, dateKey: string) => {
  const sortedBlocks = [...(schedule.blocks ?? [])].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
  )
  if (!sortedBlocks.length) return null

  const scheduleStartKey = toISODate(schedule.startDate)
  if (!scheduleStartKey || dateKey < scheduleStartKey) return null

  const [startYear, startMonth, startDay] = scheduleStartKey.split("-").map(Number)
  const [targetYear, targetMonth, targetDay] = dateKey.split("-").map(Number)
  const cursor = new Date(startYear, (startMonth ?? 1) - 1, startDay ?? 1)
  const target = new Date(targetYear, (targetMonth ?? 1) - 1, targetDay ?? 1)

  let blockIndex = 0
  let dayInBlock = 0

  while (cursor <= target) {
    if (isScheduleWeekOff(cursor, schedule)) {
      if (toISODate(cursor) === dateKey) {
        return null
      }
      cursor.setDate(cursor.getDate() + 1)
      continue
    }

    const templateId = sortedBlocks[blockIndex]?.templateId ?? null
    if (toISODate(cursor) === dateKey) {
      return templateId
    }

    dayInBlock += 1
    if (dayInBlock >= sortedBlocks[blockIndex].repeatDays) {
      blockIndex += 1
      dayInBlock = 0
      if (blockIndex >= sortedBlocks.length) {
        blockIndex = 0
      }
    }
    cursor.setDate(cursor.getDate() + 1)
  }

  return null
}

const getZonedDateParts = (value: Date, timeZone: string): ZonedDateParts => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
  const parts = formatter.formatToParts(value)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0")

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  }
}

const resolveTemplateForDate = async (staffProfileId: string, dateKey: string) => {
  const dateValue = new Date(`${dateKey}T00:00:00.000Z`)

  const override = await prisma.staffShiftOverride.findUnique({
    where: { staffProfileId_date: { staffProfileId, date: dateValue } },
    include: {
      template: {
        include: { breaks: { orderBy: { sortOrder: "asc" } } },
      },
    },
  })
  if (override) {
    if (!override.templateId || !override.template) {
      return { template: null as ShiftTemplateRow | null, reason: "Staff is unavailable on this date." }
    }
    return { template: override.template as unknown as ShiftTemplateRow, reason: "" }
  }

  const assignment = await prisma.staffScheduleAssignment.findFirst({
    where: {
      staffProfileId,
      startDate: { lte: dateValue },
      OR: [{ endDate: null }, { endDate: { gte: dateValue } }],
    },
    orderBy: { startDate: "desc" },
    include: {
      schedule: {
        include: {
          blocks: {
            orderBy: { sortOrder: "asc" },
            include: {
              template: { include: { breaks: { orderBy: { sortOrder: "asc" } } } },
            },
          },
        },
      },
    },
  })

  const schedule =
    assignment?.schedule ??
    (await prisma.shiftSchedule.findFirst({
      where: { isDefault: true },
      orderBy: { updatedAt: "desc" },
      include: {
        blocks: {
          orderBy: { sortOrder: "asc" },
          include: {
            template: { include: { breaks: { orderBy: { sortOrder: "asc" } } } },
          },
        },
      },
    }))

  if (!schedule) {
    return { template: null as ShiftTemplateRow | null, reason: "No shift schedule assigned for this staff." }
  }

  const templateId = resolveTemplateForScheduleDate(
    schedule as unknown as ShiftSchedule,
    dateKey
  )
  if (!templateId) {
    return { template: null as ShiftTemplateRow | null, reason: "This date is a week off / non-working day." }
  }
  const block = schedule.blocks.find((item) => item.templateId === templateId)
  if (!block?.template) {
    return { template: null as ShiftTemplateRow | null, reason: "Shift template not found for this date." }
  }
  return { template: block.template as unknown as ShiftTemplateRow, reason: "" }
}

export const checkStaffAppointmentAvailability = async (
  staffProfileId: string,
  startAt: Date,
  endAt: Date
): Promise<AvailabilityCheckResult> => {
  const setting = await prisma.appSetting.findUnique({
    where: { id: "global" },
    select: { timeZone: true },
  })
  const timeZone = setting?.timeZone || "America/New_York"

  const zonedStart = getZonedDateParts(startAt, timeZone)
  const zonedEnd = getZonedDateParts(endAt, timeZone)

  const dateKey = `${String(zonedStart.year).padStart(4, "0")}-${String(zonedStart.month).padStart(2, "0")}-${String(zonedStart.day).padStart(2, "0")}`
  const endDateKey = `${String(zonedEnd.year).padStart(4, "0")}-${String(zonedEnd.month).padStart(2, "0")}-${String(zonedEnd.day).padStart(2, "0")}`

  if (dateKey !== endDateKey) {
    return { ok: false, reason: "Appointment cannot span multiple local dates." }
  }

  const { template, reason } = await resolveTemplateForDate(staffProfileId, dateKey)
  if (!template) {
    return { ok: false, reason }
  }

  const startMinutes = zonedStart.hour * 60 + zonedStart.minute
  const endMinutes = zonedEnd.hour * 60 + zonedEnd.minute
  if (endMinutes <= startMinutes) {
    return { ok: false, reason: "Invalid appointment time range." }
  }

  const breaks = [...(template.breaks ?? [])].sort(
    (a, b) => toMinutes(a.startTime) - toMinutes(b.startTime)
  )

  const segments: Array<{ start: number; end: number }> = []
  let cursor = toMinutes(template.startTime)
  for (const breakPeriod of breaks) {
    const breakStart = toMinutes(breakPeriod.startTime)
    const breakEnd = toMinutes(breakPeriod.endTime)
    if (breakStart > cursor) {
      segments.push({ start: cursor, end: breakStart })
    }
    cursor = breakEnd
  }
  const shiftEnd = toMinutes(template.endTime)
  if (cursor < shiftEnd) {
    segments.push({ start: cursor, end: shiftEnd })
  }

  const isInsideShift = segments.some(
    (segment) => startMinutes >= segment.start && endMinutes <= segment.end
  )

  if (!isInsideShift) {
    return {
      ok: false,
      reason: "Selected time falls outside staff working hours or overlaps a break.",
    }
  }

  return { ok: true, templateId: template.id }
}
