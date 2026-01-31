"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import {
  Inject,
  Month,
  ResourceDirective,
  ResourcesDirective,
  ScheduleComponent,
  ViewsDirective,
  ViewDirective,
} from "@syncfusion/ej2-react-schedule"
import { toast } from "sonner"

import { formatDateForDisplay, toISODate } from "@/lib/date"

type StaffOption = {
  id: string
  name: string | null
  email: string
  image?: string | null
}

type WorkingPeriod = {
  kind: "WORK" | "BREAK"
  startTime: string
  endTime: string
}

type WorkingDay = {
  day: string
  isOpen: boolean
  periods: WorkingPeriod[]
}

type WorkingOverride = {
  date: string
  isOpen: boolean
  periods: WorkingPeriod[]
}

type SettingsPayload = {
  timeZone?: string
  dateFormat?: string
  workingHours: WorkingDay[]
  overrides: WorkingOverride[]
}

type ShiftTemplateBreak = {
  id?: string
  startTime: string
  endTime: string
  sortOrder?: number
}

type ShiftTemplate = {
  id: string
  name: string
  description?: string | null
  color?: string | null
  isActive?: boolean
  startTime: string
  endTime: string
  breaks: ShiftTemplateBreak[]
}

type TimeRange = {
  startTime: string
  endTime: string
}

type ShiftScheduleBlock = {
  id?: string
  templateId: string
  repeatDays: number
  sortOrder?: number
}

type ShiftSchedule = {
  id: string
  isDefault?: boolean
  startDate: string
  weekOffDay1: string
  weekOffDay2?: string | null
  weekOff2Weeks?: number[]
  blocks: ShiftScheduleBlock[]
}

type StaffProfile = {
  shiftSchedule?: ShiftSchedule | null
}

type AvailabilityEvent = {
  Id: string
  Subject: string
  StartTime: Date
  EndTime: Date
  IsAllDay: boolean
  staffId: string
}

const RESOURCE_COLORS = ["#0ea5e9", "#22c55e", "#f97316", "#a855f7", "#ec4899"]

export default function RosterPage() {
  const searchParams = useSearchParams()
  const debugEnabled = searchParams.get("debug") === "1"
  const scheduleRef = React.useRef<ScheduleComponent | null>(null)
  const [date, setDate] = React.useState(() => new Date())
  const [viewDates, setViewDates] = React.useState<Date[]>([])
  const [staff, setStaff] = React.useState<StaffOption[]>([])
  const [staffFilter, setStaffFilter] = React.useState<string>("all")
  const [settings, setSettings] = React.useState<SettingsPayload>({
    workingHours: [],
    overrides: [],
  })
  const [templates, setTemplates] = React.useState<ShiftTemplate[]>([])
  const [staffSchedules, setStaffSchedules] = React.useState<
    Record<string, ShiftSchedule | null>
  >({})
  const [defaultSchedule, setDefaultSchedule] = React.useState<ShiftSchedule | null>(null)

  const loadStaff = React.useCallback(async () => {
    try {
      const response = await fetch("/api/users?role=STAFF&pageSize=100")
      if (!response.ok) {
        throw new Error("Failed to load staff.")
      }
      const data = (await response.json()) as { items?: StaffOption[] }
      const items = data.items ?? []
      setStaff(items)
    } catch (error) {
      console.error(error)
      toast.error("Unable to load staff.")
    }
  }, [])

  const loadSettings = React.useCallback(async () => {
    try {
      const response = await fetch("/api/settings")
      if (!response.ok) {
        return
      }
      const data = (await response.json()) as { settings?: SettingsPayload }
      const nextSettings = data.settings
      if (nextSettings) {
        setSettings({
          workingHours: nextSettings.workingHours ?? [],
          overrides: nextSettings.overrides ?? [],
          timeZone: nextSettings.timeZone,
          dateFormat: nextSettings.dateFormat,
        })
      }
    } catch (error) {
      console.error(error)
    }
  }, [])

  const loadTemplates = React.useCallback(async () => {
    try {
      const response = await fetch("/api/shifts/templates?includeInactive=true", {
        cache: "no-store",
      })
      if (!response.ok) {
        throw new Error("Failed to load shift templates.")
      }
      const data = (await response.json()) as { items?: ShiftTemplate[] }
      const items = data.items ?? []
      setTemplates(items)
    } catch (error) {
      console.error(error)
      toast.error("Unable to load shift templates.")
    }
  }, [])

  const loadDefaultSchedule = React.useCallback(async () => {
    try {
      const response = await fetch(
        "/api/shifts/schedules?isDefault=true&page=1&pageSize=1",
        { cache: "no-store" }
      )
      if (!response.ok) {
        throw new Error("Failed to load default schedule.")
      }
      const data = (await response.json()) as { items?: ShiftSchedule[] }
      const defaultItem = data.items?.[0] ?? null
      setDefaultSchedule(defaultItem)
    } catch (error) {
      console.error(error)
      setDefaultSchedule(null)
    }
  }, [])

  const loadStaffAssignments = React.useCallback(async (staffId: string) => {
    try {
      const response = await fetch(`/api/users/${staffId}`, { cache: "no-store" })
      if (!response.ok) {
        throw new Error("Failed to load staff profile.")
      }
      const data = (await response.json()) as { user?: { staffProfile?: StaffProfile } }
      const profile = data.user?.staffProfile
      setStaffSchedules((prev) => ({
        ...prev,
        [staffId]: profile?.shiftSchedule ?? null,
      }))
    } catch (error) {
      console.error(error)
      toast.error("Unable to load staff assignments.")
    }
  }, [])

  React.useEffect(() => {
    void loadStaff()
  }, [loadStaff])

  React.useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  React.useEffect(() => {
    void loadTemplates()
  }, [loadTemplates])

  React.useEffect(() => {
    void loadDefaultSchedule()
  }, [loadDefaultSchedule])

  const refreshStaffAssignments = React.useCallback(() => {
    if (staffFilter === "all") {
      if (!staff.length) return
      void Promise.all(staff.map((member) => loadStaffAssignments(member.id)))
      return
    }
    void loadStaffAssignments(staffFilter)
  }, [loadStaffAssignments, staff, staffFilter])

  React.useEffect(() => {
    refreshStaffAssignments()
  }, [refreshStaffAssignments, staffFilter, staff])

  const filteredStaff = React.useMemo(() => {
    if (staffFilter === "all") {
      return staff
    }
    return staff.filter((member) => member.id === staffFilter)
  }, [staff, staffFilter])

  const availabilityDates = React.useMemo(() => {
    if (viewDates.length) {
      return viewDates
    }
    const current = new Date(date)
    const start = new Date(current.getFullYear(), current.getMonth(), 1)
    const dayIndex = start.getDay()
    start.setDate(start.getDate() - dayIndex)
    return Array.from({ length: 42 }, (_, index) => {
      const next = new Date(start)
      next.setDate(start.getDate() + index)
      return next
    })
  }, [date, viewDates])

  const resolveDayKey = React.useCallback((value: Date) => {
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
  }, [])

  const parseMinutes = React.useCallback((timeValue: string) => {
    const [hour, minute] = timeValue.split(":").map((chunk) => Number(chunk))
    return (Number.isNaN(hour) ? 0 : hour) * 60 + (Number.isNaN(minute) ? 0 : minute)
  }, [])

  const formatDateKey = React.useCallback((value: Date) => {
    return toISODate(value)
  }, [])

  const templateMap = React.useMemo(() => {
    const map: Record<string, ShiftTemplate> = {}
    for (const template of templates) {
      map[template.id] = template
    }
    return map
  }, [templates])

  const buildShiftSegments = React.useCallback((template: ShiftTemplate): TimeRange[] => {
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
  }, [parseMinutes])

  const getWeekOfMonth = React.useCallback((value: Date) => {
    return Math.floor((value.getDate() - 1) / 7) + 1
  }, [])

  const isScheduleWeekOff = React.useCallback(
    (value: Date, schedule: ShiftSchedule) => {
      const weekday = resolveDayKey(value)
      if (weekday === schedule.weekOffDay1) return true
      if (schedule.weekOffDay2 && weekday === schedule.weekOffDay2) {
        const weeks = schedule.weekOff2Weeks ?? []
        return weeks.includes(getWeekOfMonth(value))
      }
      return false
    },
    [getWeekOfMonth, resolveDayKey]
  )

  const buildScheduleMap = React.useCallback(
    (schedule: ShiftSchedule, dates: Date[]) => {
      if (!schedule.blocks?.length) {
        return {} as Record<string, string | null>
      }
      const sortedBlocks = [...schedule.blocks].sort(
        (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
      )
      const startDate = new Date(schedule.startDate)
      if (Number.isNaN(startDate.getTime())) {
        return {} as Record<string, string | null>
      }
      const lastDate = dates.length ? dates[dates.length - 1] : null
      if (!lastDate) {
        return {} as Record<string, string | null>
      }
      const map: Record<string, string | null> = {}
      let blockIndex = 0
      let dayInBlock = 0
      const cursor = new Date(startDate)

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
    },
    [formatDateKey, isScheduleWeekOff]
  )

  const scheduleMaps = React.useMemo(() => {
    const maps: Record<string, Record<string, string | null>> = {}
    for (const member of filteredStaff) {
      const schedule = staffSchedules[member.id] ?? defaultSchedule
      if (!schedule) continue
      maps[member.id] = buildScheduleMap(schedule, availabilityDates)
    }
    return maps
  }, [availabilityDates, buildScheduleMap, defaultSchedule, filteredStaff, staffSchedules])

  const getStaffTemplateForDate = React.useCallback(
    (value: Date, staffId?: string) => {
      if (!staffId) return null
      const dateKey = formatDateKey(value)
      const scheduleMap = scheduleMaps[staffId]
      if (scheduleMap && Object.prototype.hasOwnProperty.call(scheduleMap, dateKey)) {
        const templateId = scheduleMap[dateKey]
        return templateId ? templateMap[templateId] ?? null : null
      }
      return null
    },
    [
      formatDateKey,
      scheduleMaps,
      staffSchedules,
      defaultSchedule,
      templateMap,
    ]
  )

  const getStaffPeriodsForDate = React.useCallback(
    (value: Date, staffId?: string) => {
      if (!staffId) {
        return []
      }
      const dateKey = formatDateKey(value)
      const scheduleMap = scheduleMaps[staffId]
      if (scheduleMap && Object.prototype.hasOwnProperty.call(scheduleMap, dateKey)) {
        const templateId = scheduleMap[dateKey]
        if (!templateId) {
          return []
        }
        const template = templateMap[templateId]
        return template ? buildShiftSegments(template) : []
      }
      return []
    },
    [buildShiftSegments, formatDateKey, scheduleMaps, templateMap]
  )

  const calendarEvents = React.useMemo(() => {
    const list: AvailabilityEvent[] = []

    for (const day of availabilityDates) {
      for (const member of filteredStaff) {
        const periods = getStaffPeriodsForDate(day, member.id)
        if (!periods.length) continue
        const template = getStaffTemplateForDate(day, member.id)
        const label = template?.name ?? "Working hours"
        const start = new Date(day)
        start.setHours(0, 0, 0, 0)
        const end = new Date(start)
        end.setDate(end.getDate() + 1)
        list.push({
          Id: `${member.id}-${formatDateKey(day)}`,
          Subject: label,
          StartTime: start,
          EndTime: end,
          IsAllDay: true,
          staffId: member.id,
        })
      }
    }

    return list
  }, [availabilityDates, filteredStaff, formatDateKey, getStaffPeriodsForDate, getStaffTemplateForDate])

  React.useEffect(() => {
    if (scheduleRef.current) {
      scheduleRef.current.eventSettings = {
        ...scheduleRef.current.eventSettings,
        dataSource: calendarEvents,
      }
      scheduleRef.current.dataBind()
      scheduleRef.current.refreshEvents?.()
    }
  }, [calendarEvents])

  const staffResources = React.useMemo(
    () =>
      filteredStaff.map((member, index) => ({
        id: member.id,
        name: member.name?.trim() || member.email,
        color: RESOURCE_COLORS[index % RESOURCE_COLORS.length],
      })),
    [filteredStaff]
  )

  const debugSummary = React.useMemo(() => {
    if (!debugEnabled) {
      return null
    }
    const formatShort = (value: Date) =>
      formatDateForDisplay(value, settings.dateFormat)
    const byStaff = filteredStaff.map((member) => ({
      staff: member.name?.trim() || member.email,
      dates: availabilityDates.map((day) => ({
        date: formatShort(day),
        periods: getStaffPeriodsForDate(day, member.id).map(
          (period) => `${period.startTime}-${period.endTime}`
        ),
      })),
    }))
    return {
      selectedDate: formatShort(date),
      viewDates: availabilityDates.map((day) => formatShort(day)),
      eventsCount: calendarEvents.length,
      staffCount: filteredStaff.length,
      staff: byStaff,
    }
  }, [
    availabilityDates,
    calendarEvents.length,
    date,
    debugEnabled,
    filteredStaff,
    getStaffPeriodsForDate,
    settings.dateFormat,
  ])

  const syncViewDates = React.useCallback(() => {
    const dates = scheduleRef.current?.getCurrentViewDates?.() ?? []
    const normalizedDates = dates.map(
      (value) => new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))
    )
    if (normalizedDates.length) {
      setViewDates(normalizedDates)
    }
    const selected = scheduleRef.current?.selectedDate
    if (selected instanceof Date && !Number.isNaN(selected.getTime())) {
      setDate(new Date(selected))
    }
  }, [])

  const handleNavigate = React.useCallback((args: { currentDate?: Date | null }) => {
    if (args?.currentDate instanceof Date && !Number.isNaN(args.currentDate.getTime())) {
      setDate(new Date(args.currentDate))
    }
  }, [])

  const handleActionComplete = React.useCallback(
    (args: { requestType?: string }) => {
      if (
        args?.requestType === "dateNavigate" ||
        args?.requestType === "viewNavigate" ||
        args?.requestType === "viewRender"
      ) {
        syncViewDates()
      }
  },
    [calendarEvents.length, filteredStaff.length, syncViewDates]
  )

  return (
    <div className="flex flex-col gap-6 px-6 py-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Roster</h1>
          <p className="text-sm text-muted-foreground">
            View staff schedules in a monthly roster.
          </p>
        </div>
        <div />
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">Staff filter</label>
          <select
            className="h-10 w-full min-w-[220px] rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:w-[280px]"
            value={staffFilter}
            onChange={(event) => setStaffFilter(event.target.value)}
          >
            <option value="all">All staff</option>
            {staff.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name?.trim() || member.email}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-3 shadow-sm">
        <div className="min-h-[540px]">
          <ScheduleComponent
            ref={scheduleRef}
            currentView="Month"
            firstDayOfWeek={0}
            eventSettings={{
              dataSource: calendarEvents,
              fields: {
                id: "Id",
                subject: { name: "Subject" },
                startTime: { name: "StartTime" },
                endTime: { name: "EndTime" },
                isAllDay: { name: "IsAllDay" },
              },
            }}
            group={{ resources: ["Staff"] }}
            showWeekend
            readonly
            allowDragAndDrop={false}
            allowResizing={false}
            navigating={handleNavigate}
            actionComplete={handleActionComplete}
            created={syncViewDates}
            height="auto"
          >
            <ViewsDirective>
              <ViewDirective option="Month" />
            </ViewsDirective>
            <ResourcesDirective>
              <ResourceDirective
                field="staffId"
                title="Staff"
                name="Staff"
                dataSource={staffResources}
                textField="name"
                idField="id"
                colorField="color"
              />
            </ResourcesDirective>
            <Inject services={[Month]} />
          </ScheduleComponent>
        </div>
      </div>
      {debugEnabled && debugSummary ? (
        <div className="rounded-lg border border-dashed bg-muted/40 p-4 text-xs text-muted-foreground">
          <pre className="whitespace-pre-wrap">
            {JSON.stringify(debugSummary, null, 2)}
          </pre>
        </div>
      ) : null}
    </div>
  )
}
