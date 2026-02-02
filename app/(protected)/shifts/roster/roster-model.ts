import { parseISODate, toISODate } from "@/lib/date"
import type { ShiftSchedule, ShiftTemplateRow } from "@/types/shifts"

export type TimeRange = {
  startTime: string
  endTime: string
}

export const RESOURCE_COLORS = ["#64748b", "#64748b", "#64748b", "#64748b", "#64748b"]

export const TEMPLATE_COLORS = [
  "#0ea5e9",
  "#22c55e",
  "#f97316",
  "#a855f7",
  "#ec4899",
  "#14b8a6",
  "#f59e0b",
  "#0f766e",
  "#e11d48",
]

export const UNAVAILABLE_COLOR = "#ef4444"

export const formatDateKey = (value: Date) => toISODate(value)

export const resolveDayKey = (value: Date) => {
  const mapping = [
    "SUNDAY",
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
  ]
  return mapping[value.getDay()] ?? "SUNDAY"
}

export const parseMinutes = (timeValue: string) => {
  const [hour, minute] = timeValue.split(":").map((chunk) => Number(chunk))
  return (Number.isNaN(hour) ? 0 : hour) * 60 + (Number.isNaN(minute) ? 0 : minute)
}

export const buildTemplateMap = (templates: ShiftTemplateRow[]) => {
  const map: Record<string, ShiftTemplateRow> = {}
  for (const template of templates) {
    map[template.id] = template
  }
  return map
}

export const buildTemplateColorMap = (
  templates: ShiftTemplateRow[],
  palette: string[] = TEMPLATE_COLORS
) => {
  const map: Record<string, string> = {}
  const used = new Set<string>()
  const sorted = [...templates].sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id))

  const colorCounts = sorted.reduce<Record<string, number>>((acc, template) => {
    const color = template.color?.trim()
    if (!color) return acc
    acc[color] = (acc[color] ?? 0) + 1
    return acc
  }, {})

  sorted.forEach((template) => {
    const color = template.color?.trim()
    if (color && colorCounts[color] === 1) {
      map[template.id] = color
      used.add(color)
      return
    }
    const available = palette.find((value) => !used.has(value))
    if (available) {
      map[template.id] = available
      used.add(available)
      return
    }
    const fallbackIndex = template.id.length % palette.length
    map[template.id] = palette[fallbackIndex]
  })

  return map
}

export const buildShiftSegments = (template: ShiftTemplateRow): TimeRange[] => {
  const shiftStart = template.startTime
  const shiftEnd = template.endTime
  const breaks = [...(template.breaks ?? [])].sort(
    (a, b) => parseMinutes(a.startTime) - parseMinutes(b.startTime)
  )
  const segments: TimeRange[] = []
  let cursor = shiftStart
  for (const breakPeriod of breaks) {
    if (parseMinutes(breakPeriod.startTime) > parseMinutes(cursor)) {
      segments.push({ startTime: cursor, endTime: breakPeriod.startTime })
    }
    cursor = breakPeriod.endTime
  }
  if (parseMinutes(cursor) < parseMinutes(shiftEnd)) {
    segments.push({ startTime: cursor, endTime: shiftEnd })
  }
  return segments
}

const getWeekOfMonth = (value: Date) => Math.floor((value.getDate() - 1) / 7) + 1

export const isScheduleWeekOff = (value: Date, schedule: ShiftSchedule) => {
  const weekday = resolveDayKey(value)
  if (weekday === schedule.weekOffDay1) return true
  if (schedule.weekOffDay2 && weekday === schedule.weekOffDay2) {
    const weeks = schedule.weekOff2Weeks ?? []
    return weeks.includes(getWeekOfMonth(value))
  }
  return false
}

export const buildScheduleMap = (
  schedule: ShiftSchedule,
  dates: Date[],
  startDateOverride?: Date,
  endDateOverride?: Date
) => {
  if (!schedule.blocks?.length) {
    return {} as Record<string, string | null>
  }
  const sortedBlocks = [...schedule.blocks].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  const startDate = startDateOverride ?? parseISODate(schedule.startDate)
  if (!startDate) {
    return {} as Record<string, string | null>
  }
  const lastDate = endDateOverride ?? (dates.length ? dates[dates.length - 1] : null)
  if (!lastDate) {
    return {} as Record<string, string | null>
  }
  const map: Record<string, string | null> = {}
  let blockIndex = 0
  let dayInBlock = 0
  const cursor = new Date(startDate)

  if (cursor > lastDate) {
    return map
  }

  while (cursor <= lastDate && blockIndex < sortedBlocks.length) {
    const dateKey = formatDateKey(cursor)
    if (isScheduleWeekOff(cursor, schedule)) {
      map[dateKey] = null
    } else {
      map[dateKey] = sortedBlocks[blockIndex]?.templateId ?? null
      dayInBlock += 1
      if (dayInBlock >= sortedBlocks[blockIndex].repeatDays) {
        blockIndex += 1
        dayInBlock = 0
        if (blockIndex >= sortedBlocks.length) {
          blockIndex = 0
        }
      }
    }
    cursor.setDate(cursor.getDate() + 1)
  }

  return map
}

