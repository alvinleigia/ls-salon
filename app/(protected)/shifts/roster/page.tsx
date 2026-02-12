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

import { formatDateForDisplay, parseISODate, toISODate } from "@/lib/date"
import {
  formatTimeFrom24h,
  formatTimeFromDate,
  weekdayToSchedulerFirstDay,
} from "@/lib/formatting"
import { Button } from "@/components/ui/button"
import { SearchableSelect } from "@/components/searchable-select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { TimePicker } from "@/components/ui/time-picker"
import type { AppSettingsPayload } from "@/types/scheduling"
import type {
  AppointmentConflict,
  AvailabilityEvent,
  ShiftOverride,
  ShiftSchedule,
  ShiftTemplateRow,
  StaffOption,
  StaffScheduleAssignment,
} from "@/types/shifts"
import {
  RESOURCE_COLORS,
  UNAVAILABLE_COLOR,
  buildScheduleMap,
  buildShiftSegments,
  buildTemplateColorMap,
  buildTemplateMap,
  formatDateKey,
} from "./roster-model"

export default function RosterPage() {
  const searchParams = useSearchParams()
  const debugEnabled = searchParams.get("debug") === "1"
  const scheduleRef = React.useRef<ScheduleComponent | null>(null)
  const [date, setDate] = React.useState(() => new Date())
  const [viewDates, setViewDates] = React.useState<Date[]>([])
  const [staff, setStaff] = React.useState<StaffOption[]>([])
  const [staffFilter, setStaffFilter] = React.useState<string>("all")
  const [settings, setSettings] = React.useState<AppSettingsPayload>({
    workingHours: [],
    overrides: [],
  })
  const [firstDayOfWeek, setFirstDayOfWeek] = React.useState(0)
  const [templates, setTemplates] = React.useState<ShiftTemplateRow[]>([])
  const [staffAssignments, setStaffAssignments] = React.useState<
    Record<string, StaffScheduleAssignment[]>
  >({})
  const [defaultSchedule, setDefaultSchedule] = React.useState<ShiftSchedule | null>(null)
  const [overrides, setOverrides] = React.useState<ShiftOverride[]>([])
  const [overrideOpen, setOverrideOpen] = React.useState(false)
  const [overrideStaffId, setOverrideStaffId] = React.useState<string>("")
  const [overrideStartDate, setOverrideStartDate] = React.useState<string>("")
  const [overrideEndDate, setOverrideEndDate] = React.useState<string>("")
  const [overrideTemplateId, setOverrideTemplateId] = React.useState<string>("")
  const [overrideSkipWeekOff, setOverrideSkipWeekOff] = React.useState(false)
  const [overrideUnavailable, setOverrideUnavailable] = React.useState(false)
  const [conflictsOpen, setConflictsOpen] = React.useState(false)
  const [conflicts, setConflicts] = React.useState<AppointmentConflict[]>([])
  const [conflictAction, setConflictAction] = React.useState<
    "cancel" | "reassign" | "reschedule"
  >("cancel")
  const [conflictStaffId, setConflictStaffId] = React.useState("")
  const [conflictRescheduleDate, setConflictRescheduleDate] = React.useState("")
  const [conflictRescheduleTime, setConflictRescheduleTime] = React.useState("")

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
      const data = (await response.json()) as { settings?: AppSettingsPayload }
      const nextSettings = data.settings
      if (nextSettings) {
        setSettings({
          workingHours: nextSettings.workingHours ?? [],
          overrides: nextSettings.overrides ?? [],
          timeZone: nextSettings.timeZone,
          dateFormat: nextSettings.dateFormat,
          timeFormat: nextSettings.timeFormat,
        })
        setFirstDayOfWeek(weekdayToSchedulerFirstDay(nextSettings.firstDayOfWeek))
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
      const data = (await response.json()) as { items?: ShiftTemplateRow[] }
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

  const loadStaffAssignments = React.useCallback(
    async (staffIds: string[], rangeStart: string, rangeEnd: string) => {
      try {
        const response = await fetch(
          `/api/shifts/assignments?startDate=${rangeStart}&endDate=${rangeEnd}&staffIds=${staffIds.join(
            ","
          )}`,
          { cache: "no-store" }
        )
        if (!response.ok) {
          throw new Error("Failed to load staff assignments.")
        }
        const data = (await response.json()) as { items?: StaffScheduleAssignment[] }
        const grouped: Record<string, StaffScheduleAssignment[]> = {}
        for (const assignment of data.items ?? []) {
          if (!assignment.staffId) continue
          if (!grouped[assignment.staffId]) {
            grouped[assignment.staffId] = []
          }
          grouped[assignment.staffId].push(assignment)
        }
        setStaffAssignments(grouped)
      } catch (error) {
        console.error(error)
        toast.error("Unable to load staff schedules.")
      }
    },
    []
  )

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

  React.useEffect(() => {
    if (!staff.length || !availabilityDates.length) return
    const rangeStart = toISODate(availabilityDates[0])
    const rangeEnd = toISODate(availabilityDates[availabilityDates.length - 1])
    const staffIds =
      staffFilter === "all"
        ? staff.map((member) => member.id)
        : staff.filter((member) => member.id === staffFilter).map((member) => member.id)
    if (!staffIds.length) return
    void loadStaffAssignments(staffIds, rangeStart, rangeEnd)
  }, [availabilityDates, loadStaffAssignments, staff, staffFilter])

  const filteredStaff = React.useMemo(() => {
    if (staffFilter === "all") {
      return staff
    }
    return staff.filter((member) => member.id === staffFilter)
  }, [staff, staffFilter])

  const loadOverrides = React.useCallback(async () => {
    if (!viewDates.length || !staff.length) return
    const start = toISODate(viewDates[0])
    const end = toISODate(viewDates[viewDates.length - 1])
    const staffIds =
      staffFilter === "all" ? staff.map((member) => member.id) : [staffFilter]
    if (!staffIds.length) return
    try {
      const response = await fetch(
        `/api/shifts/overrides?startDate=${start}&endDate=${end}&staffIds=${staffIds.join(",")}`,
        { cache: "no-store" }
      )
      if (!response.ok) {
        throw new Error("Failed to load overrides.")
      }
      const data = (await response.json()) as { items?: ShiftOverride[] }
      setOverrides(data.items ?? [])
    } catch (error) {
      console.error(error)
      toast.error("Unable to load roster overrides.")
    }
  }, [staff, staffFilter, viewDates])

  React.useEffect(() => {
    void loadOverrides()
  }, [loadOverrides])

  const templateMap = React.useMemo(() => buildTemplateMap(templates), [templates])

  const templateColorMap = React.useMemo(
    () => buildTemplateColorMap(templates),
    [templates]
  )

  const scheduleMaps = React.useMemo(() => {
    const maps: Record<string, Record<string, string | null>> = {}
    const viewEnd = availabilityDates[availabilityDates.length - 1]
    const viewEndDate = viewEnd ? new Date(viewEnd) : null
    for (const member of filteredStaff) {
      const assignments = staffAssignments[member.id] ?? []
      const baseMap: Record<string, string | null> = {}
      for (const assignment of assignments) {
        const startDate = parseISODate(assignment.startDate)
        if (!startDate) continue
        const endDate = assignment.endDate ? parseISODate(assignment.endDate) : viewEndDate
        if (!endDate) continue
        const map = buildScheduleMap(
          assignment.schedule,
          availabilityDates,
          startDate,
          endDate
        )
        Object.assign(baseMap, map)
      }
      if (!assignments.length && defaultSchedule) {
        Object.assign(baseMap, buildScheduleMap(defaultSchedule, availabilityDates))
      }
      maps[member.id] = baseMap
    }
    return maps
  }, [availabilityDates, buildScheduleMap, defaultSchedule, filteredStaff, staffAssignments])

  const overrideMap = React.useMemo(() => {
    const map: Record<string, Record<string, string | null>> = {}
    for (const override of overrides) {
      if (!override.staffId) continue
      if (!map[override.staffId]) {
        map[override.staffId] = {}
      }
      map[override.staffId][toISODate(override.date)] =
        override.templateId ?? null
    }
    return map
  }, [overrides])

  const getStaffTemplateForDate = React.useCallback(
    (value: Date, staffId?: string) => {
      if (!staffId) return null
      const dateKey = formatDateKey(value)
      const override = overrideMap[staffId]?.[dateKey]
      if (override !== undefined) {
        return override ? templateMap[override] ?? null : null
      }
      const scheduleMap = scheduleMaps[staffId]
      if (scheduleMap && Object.prototype.hasOwnProperty.call(scheduleMap, dateKey)) {
        const templateId = scheduleMap[dateKey]
        return templateId ? templateMap[templateId] ?? null : null
      }
      return null
    },
    [formatDateKey, scheduleMaps, templateMap, overrideMap]
  )

  const getStaffPeriodsForDate = React.useCallback(
    (value: Date, staffId?: string) => {
      if (!staffId) {
        return []
      }
      const dateKey = formatDateKey(value)
      const override = overrideMap[staffId]?.[dateKey]
      if (override !== undefined) {
        if (!override) {
          return []
        }
        const template = templateMap[override]
        return template ? buildShiftSegments(template) : []
      }
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
    [buildShiftSegments, formatDateKey, overrideMap, scheduleMaps, templateMap]
  )

  const calendarEvents = React.useMemo(() => {
    const list: AvailabilityEvent[] = []

    for (const day of availabilityDates) {
      for (const member of filteredStaff) {
        const dateKey = formatDateKey(day)
        const overrideValue = overrideMap[member.id]?.[dateKey]
        if (overrideValue === null) {
          const start = new Date(day)
          start.setHours(0, 0, 0, 0)
          const end = new Date(start)
          end.setDate(end.getDate() + 1)
          list.push({
            Id: `${member.id}-${dateKey}-unavailable`,
            Subject: "Unavailable",
            StartTime: start,
            EndTime: end,
            IsAllDay: true,
            staffId: member.id,
            isUnavailable: true,
            CategoryColor: UNAVAILABLE_COLOR,
          })
          continue
        }
        const periods = getStaffPeriodsForDate(day, member.id)
        if (!periods.length) continue
        const template = getStaffTemplateForDate(day, member.id)
        const label = template?.name ?? "Working hours"
        const start = new Date(day)
        start.setHours(0, 0, 0, 0)
        const end = new Date(start)
        end.setDate(end.getDate() + 1)
        const breaks = (template?.breaks ?? [])
          .map(
            (period) =>
              `${formatTimeFrom24h(period.startTime, settings)} - ${formatTimeFrom24h(
                period.endTime,
                settings
              )}`
          )
          .filter(Boolean)
        list.push({
          Id: `${member.id}-${formatDateKey(day)}`,
          Subject: label,
          StartTime: start,
          EndTime: end,
          IsAllDay: true,
          staffId: member.id,
          templateStart: template?.startTime,
          templateEnd: template?.endTime,
          templateBreaks: breaks.length ? breaks : undefined,
          CategoryColor: template ? templateColorMap[template.id] : undefined,
        })
      }
    }

    return list
  }, [
    availabilityDates,
    filteredStaff,
    formatDateKey,
    getStaffPeriodsForDate,
    getStaffTemplateForDate,
    settings,
    templateColorMap,
  ])

  const openOverrideEditor = React.useCallback(
    (staffId: string, dateValue: Date) => {
      const dateKey = toISODate(dateValue)
      setOverrideStaffId(staffId)
      setOverrideStartDate(dateKey)
      setOverrideEndDate(dateKey)
      setOverrideTemplateId("")
      setOverrideSkipWeekOff(false)
      setOverrideUnavailable(false)
      setOverrideOpen(true)
    },
    []
  )

  const quickInfoContent = React.useCallback((props: Record<string, unknown>) => {
    const data = props as AvailabilityEvent
    if (!data?.Subject) return null
    return (
      <div className="space-y-2 text-sm">
        <div className="font-medium">{data.Subject}</div>
        {data.templateStart && data.templateEnd ? (
          <div>
            Shift: {formatTimeFrom24h(data.templateStart, settings)} -{" "}
            {formatTimeFrom24h(data.templateEnd, settings)}
          </div>
        ) : null}
        {data.templateBreaks?.length ? (
          <div>
            Breaks: {data.templateBreaks.join(", ")}
          </div>
        ) : null}
        {data.isUnavailable ? (
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Unavailable
          </div>
        ) : null}
        {data.staffId ? (
          <Button
            type="button"
            variant="secondary"
            className="mt-2 h-8 w-full px-3 text-xs"
            onClick={() => openOverrideEditor(data.staffId, data.StartTime)}
          >
            Change shift
          </Button>
        ) : null}
      </div>
    )
  }, [openOverrideEditor, settings])

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
            (period) =>
              `${formatTimeFrom24h(period.startTime, settings)}-${formatTimeFrom24h(
                period.endTime,
                settings
              )}`
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
    settings,
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

  const handleEventRendered = React.useCallback(
    (args: { data?: Record<string, unknown>; element?: HTMLElement }) => {
      const color = args.data?.CategoryColor as string | undefined
      if (color && args.element) {
        args.element.style.backgroundColor = color
        args.element.style.borderColor = color
        args.element.style.color = "#ffffff"
      }
    },
    []
  )

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
    [syncViewDates]
  )

  const resolveStaffIdForGroup = React.useCallback((groupIndex?: number) => {
    if (groupIndex === undefined || groupIndex === null) {
      if (staffFilter !== "all") return staffFilter
      return undefined
    }
    const resource = scheduleRef.current?.getResourcesByIndex?.(groupIndex)
    return resource?.resourceData?.id as string | undefined
  }, [staffFilter])

  const handleCellClick = React.useCallback(
    (args: { startTime?: Date; groupIndex?: number; element?: HTMLElement | HTMLElement[] }) => {
      if (!(args?.startTime instanceof Date)) return
      let groupIndex = args.groupIndex
      const element = Array.isArray(args.element) ? args.element[0] : args.element
      if (groupIndex === undefined && element) {
        const raw = element.getAttribute("data-group-index")
        if (raw) {
          const parsed = Number(raw)
          groupIndex = Number.isNaN(parsed) ? groupIndex : parsed
        }
      }
      const staffId = resolveStaffIdForGroup(groupIndex)
      if (!staffId) return
      openOverrideEditor(staffId, args.startTime)
    },
    [openOverrideEditor, resolveStaffIdForGroup]
  )

  const handleCellDoubleClick = React.useCallback(
    (args: { startTime?: Date; groupIndex?: number }) => {
      if (!(args?.startTime instanceof Date)) return
      const staffId = resolveStaffIdForGroup(args.groupIndex)
      if (!staffId) return
      openOverrideEditor(staffId, args.startTime)
    },
    [openOverrideEditor, resolveStaffIdForGroup]
  )

  const handleEventClick = React.useCallback(
    (args: { event?: Record<string, unknown>; data?: Record<string, unknown> }) => {
      const eventData = (args?.event ?? args?.data) as AvailabilityEvent | undefined
      if (!eventData?.StartTime || !eventData.staffId) return
      openOverrideEditor(eventData.staffId, eventData.StartTime)
    },
    [openOverrideEditor]
  )

  const handlePopupOpen = React.useCallback(
    (args: {
      type?: string
      data?: Record<string, unknown>
      target?: HTMLElement
      cancel?: boolean
    }) => {
      if (args.type !== "QuickInfo") return
      const data = args.data as Record<string, unknown> | undefined
      const startTime =
        (data?.StartTime as Date | undefined) ||
        (data?.startTime as Date | undefined)
      const staffId =
        (data?.staffId as string | undefined) ||
        resolveStaffIdForGroup(data?.groupIndex as number | undefined)
      if (!startTime || !staffId) {
        const target = args.target
        const rawIndex = target?.getAttribute?.("data-group-index")
        const parsed = rawIndex ? Number(rawIndex) : undefined
        const fallbackStaffId = resolveStaffIdForGroup(
          Number.isNaN(parsed ?? NaN) ? undefined : parsed
        )
        if (startTime && fallbackStaffId) {
          openOverrideEditor(fallbackStaffId, startTime)
          args.cancel = true
        }
        return
      }
      openOverrideEditor(staffId, startTime)
      args.cancel = true
    },
    [openOverrideEditor, resolveStaffIdForGroup]
  )

  React.useEffect(() => {
    const host = scheduleRef.current?.element
    if (!host) return

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (!target) return
      if (target.closest(".e-appointment")) return
      const cell = target.closest(".e-work-cells") as HTMLElement | null
      if (!cell) return
      const details = scheduleRef.current?.getCellDetails?.(cell)
      if (!details?.startTime) return
      const staffId = resolveStaffIdForGroup(details.groupIndex)
      if (!staffId) return
      openOverrideEditor(staffId, details.startTime)
    }

    host.addEventListener("click", handleClick)
    return () => {
      host.removeEventListener("click", handleClick)
    }
  }, [openOverrideEditor, resolveStaffIdForGroup, viewDates.length])

  const submitOverride = React.useCallback(async () => {
    if (!overrideStaffId) {
      toast.error("Select a staff member.")
      return
    }
    if (!overrideUnavailable && !overrideTemplateId) {
      toast.error("Select a shift template.")
      return
    }
    if (!overrideStartDate || !overrideEndDate) {
      toast.error("Select a date range.")
      return
    }
    if (overrideStartDate > overrideEndDate) {
      toast.error("Start date must be before end date.")
      return
    }
    try {
      const response = await fetch("/api/shifts/overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffId: overrideStaffId,
          templateId: overrideUnavailable ? "" : overrideTemplateId,
          isUnavailable: overrideUnavailable,
          startDate: overrideStartDate,
          endDate: overrideEndDate,
          skipWeekOff: overrideSkipWeekOff,
          skipHolidays: overrideSkipWeekOff,
        }),
      })
      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        if (response.status === 409 && Array.isArray(error.conflicts)) {
          setConflicts(error.conflicts)
          setConflictsOpen(true)
          throw new Error("Shift change conflicts with existing appointments.")
        }
        throw new Error(error.error || "Failed to save override.")
      }
      const result = (await response.json()) as { createdCount?: number }
      if (!result.createdCount) {
        toast.error("No dates updated. Check skip holidays/week off.")
        return
      }
      toast.success("Shift override saved.")
      setOverrideOpen(false)
      await loadOverrides()
    } catch (error) {
      console.error(error)
      toast.error(
        error instanceof Error ? error.message : "Unable to save override."
      )
    }
  }, [
    loadOverrides,
    overrideEndDate,
    overrideSkipWeekOff,
    overrideStaffId,
    overrideStartDate,
    overrideTemplateId,
    overrideUnavailable,
  ])

  const clearOverride = React.useCallback(async () => {
    if (!overrideStaffId || !overrideStartDate || !overrideEndDate) {
      toast.error("Select a staff member and date range.")
      return
    }
    if (overrideStartDate > overrideEndDate) {
      toast.error("Start date must be before end date.")
      return
    }
    try {
      const response = await fetch("/api/shifts/overrides", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffId: overrideStaffId,
          startDate: overrideStartDate,
          endDate: overrideEndDate,
        }),
      })
      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || "Failed to clear overrides.")
      }
      const result = (await response.json()) as { deletedCount?: number }
      if (!result.deletedCount) {
        toast.error("No overrides found for that range.")
        return
      }
      toast.success("Overrides cleared.")
      setOverrideOpen(false)
      await loadOverrides()
    } catch (error) {
      console.error(error)
      toast.error(
        error instanceof Error ? error.message : "Unable to clear overrides."
      )
    }
  }, [loadOverrides, overrideEndDate, overrideStaffId, overrideStartDate])

  const resolveConflicts = React.useCallback(async () => {
    if (!conflicts.length) {
      setConflictsOpen(false)
      return
    }
    if (conflictAction === "reassign" && !conflictStaffId) {
      toast.error("Select a staff member.")
      return
    }
    if (
      conflictAction === "reschedule" &&
      (!conflictRescheduleDate || !conflictRescheduleTime)
    ) {
      toast.error("Select a new date and time.")
      return
    }
    try {
      const response = await fetch("/api/appointments/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentIds: conflicts.map((item) => item.id),
          action: conflictAction,
          targetStaffId: conflictAction === "reassign" ? conflictStaffId : undefined,
          rescheduleDate: conflictAction === "reschedule" ? conflictRescheduleDate : undefined,
          rescheduleTime: conflictAction === "reschedule" ? conflictRescheduleTime : undefined,
        }),
      })
      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || "Unable to resolve conflicts.")
      }
      toast.success("Appointments updated.")
      setConflictsOpen(false)
      setConflicts([])
      await loadOverrides()
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : "Unable to resolve conflicts.")
    }
  }, [
    conflicts,
    conflictAction,
    conflictRescheduleDate,
    conflictRescheduleTime,
    conflictStaffId,
    loadOverrides,
  ])


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
          <div className="w-full min-w-[220px] md:w-[280px]">
            <SearchableSelect
            value={staffFilter}
            placeholder="All staff"
            searchPlaceholder="Search staff..."
            options={[
              { value: "all", label: "All staff" },
              ...staff.map((member) => ({
                value: member.id,
                label: member.name?.trim() || member.email,
              })),
            ]}
            onChange={(nextValue) => setStaffFilter(nextValue)}
          />
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-3 shadow-sm">
        <div className="min-h-[540px]">
          <ScheduleComponent
            ref={scheduleRef}
            currentView="Month"
            firstDayOfWeek={firstDayOfWeek}
            showQuickInfo
            eventSettings={{
              dataSource: calendarEvents,
              fields: {
                id: "Id",
                subject: { name: "Subject" },
                startTime: { name: "StartTime" },
                endTime: { name: "EndTime" },
                isAllDay: { name: "IsAllDay" },
                categoryColor: { name: "CategoryColor" },
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
            cellClick={handleCellClick}
            cellDoubleClick={handleCellDoubleClick}
            eventClick={handleEventClick}
            eventRendered={handleEventRendered}
            popupOpen={handlePopupOpen}
            quickInfoTemplates={{
              templateType: "Event",
              content: quickInfoContent,
            }}
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
      <Dialog open={overrideOpen} onOpenChange={setOverrideOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Change shift</DialogTitle>
            <DialogDescription>
              Apply a shift template to a date range for this staff member.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Staff</Label>
              <SearchableSelect
                value={overrideStaffId}
                placeholder="Select staff"
                searchPlaceholder="Search staff..."
                options={staff.map((member) => ({
                  value: member.id,
                  label: member.name?.trim() || member.email,
                }))}
                onChange={(nextValue) => setOverrideStaffId(nextValue)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Shift template</Label>
              <SearchableSelect
                value={overrideTemplateId}
                placeholder="Select template"
                searchPlaceholder="Search template..."
                options={templates.map((template) => ({
                  value: template.id,
                  label: `${template.name} (${formatTimeFrom24h(
                    template.startTime,
                    settings
                  )}-${formatTimeFrom24h(template.endTime, settings)})`,
                }))}
                onChange={(nextValue) => setOverrideTemplateId(nextValue)}
                disabled={overrideUnavailable}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Start date</Label>
                <Input
                  type="date"
                  value={overrideStartDate}
                  onChange={(event) => setOverrideStartDate(event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">End date</Label>
                <Input
                  type="date"
                  value={overrideEndDate}
                  onChange={(event) => setOverrideEndDate(event.target.value)}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={overrideUnavailable}
                onChange={(event) => {
                  const next = event.target.checked
                  setOverrideUnavailable(next)
                  if (next) {
                    setOverrideTemplateId("")
                  }
                }}
              />
              Mark as unavailable
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={overrideSkipWeekOff}
                onChange={(event) => setOverrideSkipWeekOff(event.target.checked)}
              />
              Skip holidays / week off
            </label>
          </div>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setOverrideOpen(false)}>
              Cancel
            </Button>
            <Button variant="outline" onClick={clearOverride}>
              Clear override
            </Button>
            <Button onClick={submitOverride}>Save override</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={conflictsOpen} onOpenChange={setConflictsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Resolve appointment conflicts</DialogTitle>
            <DialogDescription>
              The shift change overlaps existing appointments. Choose how to handle them.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md border p-3 text-sm text-muted-foreground">
              {conflicts.length} appointment{conflicts.length === 1 ? "" : "s"} in conflict.
            </div>
            <div className="space-y-2">
              {conflicts.map((item) => (
                <div key={item.id} className="rounded-md border p-3 text-xs">
                  <div className="text-sm font-medium">
                    {item.serviceName ?? "Service"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {item.customerName || item.customerEmail || "Customer"} •{" "}
                    {formatDateForDisplay(item.startAt, settings.dateFormat)}{" "}
                    {formatTimeFromDate(item.startAt, settings)}
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Action</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={conflictAction}
                onChange={(event) =>
                  setConflictAction(event.target.value as "cancel" | "reassign" | "reschedule")
                }
              >
                <option value="cancel">Cancel appointments</option>
                <option value="reassign">Reassign to another staff</option>
                <option value="reschedule">Reschedule to another time</option>
              </select>
            </div>
            {conflictAction === "reassign" ? (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Reassign staff</Label>
                <SearchableSelect
                  value={conflictStaffId}
                  placeholder="Select staff"
                  searchPlaceholder="Search staff..."
                  options={staff.map((member) => ({
                    value: member.id,
                    label: member.name?.trim() || member.email,
                  }))}
                  onChange={(nextValue) => setConflictStaffId(nextValue)}
                />
              </div>
            ) : null}
            {conflictAction === "reschedule" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">New date</Label>
                  <Input
                    type="date"
                    value={conflictRescheduleDate}
                    onChange={(event) => setConflictRescheduleDate(event.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">New time</Label>
                  <TimePicker
                    value={conflictRescheduleTime}
                    timeFormat={settings.timeFormat ?? "H24"}
                    onChange={(nextValue) => setConflictRescheduleTime(nextValue)}
                  />
                </div>
              </div>
            ) : null}
          </div>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setConflictsOpen(false)}>
              Close
            </Button>
            <Button onClick={resolveConflicts}>Apply resolution</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

