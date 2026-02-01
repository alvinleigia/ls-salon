"use client"

import * as React from "react"
import {
  ColumnDef,
  SortingState,
  VisibilityState,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon, MoreHorizontalIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  DataTable,
  DataTablePagination,
  DataTableToolbar,
} from "@/components/data-table"
import { FormField } from "@/components/form-field"
import { useFormErrors } from "@/hooks/use-form-errors"
import { formatDateForDisplay, toISODate } from "@/lib/date"
import type { ListResponse } from "@/types/api"

type Weekday =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY"

const WEEKDAYS: { value: Weekday; label: string }[] = [
  { value: "MONDAY", label: "Monday" },
  { value: "TUESDAY", label: "Tuesday" },
  { value: "WEDNESDAY", label: "Wednesday" },
  { value: "THURSDAY", label: "Thursday" },
  { value: "FRIDAY", label: "Friday" },
  { value: "SATURDAY", label: "Saturday" },
  { value: "SUNDAY", label: "Sunday" },
]

type StaffOption = {
  id: string
  name: string | null
  email: string
}

type ShiftTemplateOption = {
  id: string
  name: string
}

type ShiftScheduleBlock = {
  id?: string
  templateId: string
  repeatDays: number
  sortOrder?: number
  template?: ShiftTemplateOption | null
}

type ShiftScheduleRow = {
  id: string
  name: string | null
  isDefault?: boolean
  startDate: string
  weekOffDay1: Weekday
  weekOffDay2: Weekday | null
  weekOff2Weeks: number[]
  blocks: ShiftScheduleBlock[]
  assignments?: {
    id: string
    startDate: string
    endDate?: string | null
    staffProfile?: { user?: StaffOption | null } | null
  }[]
  createdAt: string
  updatedAt: string
}

type ShiftScheduleForm = {
  name: string
  staffIds: string[]
  isDefault: boolean
  startDate: string
  assignmentStartDate: string
  assignmentEndDate: string
  weekOffDay1: Weekday
  weekOffDay2: Weekday | ""
  weekOff2Weeks: number[]
  blocks: { templateId: string; repeatDays: number }[]
}

const SortIndicator = ({ value }: { value: false | "asc" | "desc" }) => {
  if (value === "asc") return <ArrowUpIcon className="h-4 w-4" />
  if (value === "desc") return <ArrowDownIcon className="h-4 w-4" />
  return <ArrowUpDownIcon className="h-4 w-4" />
}

const toDateInputValue = (value?: string | null) => {
  if (!value) return ""
  return toISODate(value)
}

const summarizeBlocks = (blocks: ShiftScheduleBlock[]) => {
  if (!blocks.length) return "-"
  return blocks
    .map((block) => {
      const label = block.template?.name ?? "Template"
      return `${label} x${block.repeatDays}`
    })
    .join(" - ")
}

const summarizeWeekOff = (schedule: ShiftScheduleRow) => {
  const day1 = WEEKDAYS.find((item) => item.value === schedule.weekOffDay1)?.label ?? schedule.weekOffDay1
  if (!schedule.weekOffDay2) {
    return day1
  }
  const day2 = WEEKDAYS.find((item) => item.value === schedule.weekOffDay2)?.label ?? schedule.weekOffDay2
  const weeks =
    schedule.weekOff2Weeks?.length ? ` (weeks ${schedule.weekOff2Weeks.join(", ")})` : ""
  return `${day1} + ${day2}${weeks}`
}

const summarizeAssignments = (schedule: ShiftScheduleRow) => {
  if (schedule.isDefault) return "All staff"
  const assignments = schedule.assignments ?? []
  const names = assignments
    .map((assignment) => assignment.staffProfile?.user?.name || assignment.staffProfile?.user?.email)
    .filter(Boolean) as string[]
  if (!names.length) return "-"
  if (names.length <= 2) return names.join(", ")
  return `${names.slice(0, 2).join(", ")} +${names.length - 2}`
}

const summarizeAssignmentRange = (schedule: ShiftScheduleRow) => {
  const assignments = schedule.assignments ?? []
  if (!assignments.length) return "-"
  const rangeStart = assignments[0]?.startDate
  const rangeEnd = assignments[0]?.endDate
  if (!rangeStart) return "-"
  if (!rangeEnd) return `${formatDateForDisplay(rangeStart)} onward`
  return `${formatDateForDisplay(rangeStart)} - ${formatDateForDisplay(rangeEnd)}`
}

export default function ShiftSchedulesPage() {
  type PaginationState = { pageIndex: number; pageSize: number }

  const [schedules, setSchedules] = React.useState<ShiftScheduleRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [totalRows, setTotalRows] = React.useState(0)

  const [templates, setTemplates] = React.useState<ShiftTemplateOption[]>([])
  const [staffOptions, setStaffOptions] = React.useState<StaffOption[]>([])

  const [staffFilter, setStaffFilter] = React.useState("all")
  const [startDateFilter, setStartDateFilter] = React.useState("")
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({
    name: true,
    staff: true,
    startDate: true,
    weekOff: true,
    blocks: true,
    updatedAt: true,
  })
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })

  const [createOpen, setCreateOpen] = React.useState(false)
  const [editOpen, setEditOpen] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<ShiftScheduleRow | null>(null)
  const [editingSchedule, setEditingSchedule] = React.useState<ShiftScheduleRow | null>(null)

  const today = React.useMemo(() => toISODate(new Date()), [])
  const defaultForm: ShiftScheduleForm = {
    name: "",
    staffIds: [],
    isDefault: false,
    startDate: today,
    assignmentStartDate: today,
    assignmentEndDate: "",
    weekOffDay1: "SUNDAY",
    weekOffDay2: "",
    weekOff2Weeks: [],
    blocks: [{ templateId: "", repeatDays: 1 }],
  }

  const [newSchedule, setNewSchedule] = React.useState<ShiftScheduleForm>(defaultForm)
  const [editSchedule, setEditSchedule] = React.useState<ShiftScheduleForm>(defaultForm)

  const {
    errors: createErrors,
    setErrorsFromResponse: setCreateErrorsFromResponse,
    clearErrors: clearCreateErrors,
  } = useFormErrors()
  const {
    errors: editErrors,
    setErrorsFromResponse: setEditErrorsFromResponse,
    clearErrors: clearEditErrors,
  } = useFormErrors()

  const totalPages = Math.max(1, Math.ceil(totalRows / pagination.pageSize))

  const loadSchedules = React.useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set("page", String(pagination.pageIndex + 1))
    params.set("pageSize", String(pagination.pageSize))
    if (staffFilter !== "all") {
      params.set("staffId", staffFilter)
    }
    if (startDateFilter) {
      params.set("startDate", startDateFilter)
    }
    if (sorting[0]) {
      params.set("sort", sorting[0].id)
      params.set("order", sorting[0].desc ? "desc" : "asc")
    }

    const response = await fetch(`/api/shifts/schedules?${params.toString()}`)
    if (!response.ok) {
      toast.error("Unable to load shift schedules.")
      setSchedules([])
      setTotalRows(0)
      setLoading(false)
      return
    }
    const data = (await response.json()) as ListResponse<ShiftScheduleRow>
    setSchedules(data.items)
    setTotalRows(data.total)
    setLoading(false)
  }, [pagination.pageIndex, pagination.pageSize, sorting, staffFilter, startDateFilter])

  const loadTemplates = React.useCallback(async () => {
    const response = await fetch("/api/shifts/templates?includeInactive=true", {
      cache: "no-store",
    })
    if (!response.ok) {
      toast.error("Unable to load shift templates.")
      setTemplates([])
      return
    }
    const data = (await response.json()) as { items?: ShiftTemplateOption[] }
    setTemplates(data.items ?? [])
  }, [])

  const loadStaff = React.useCallback(async () => {
    const response = await fetch("/api/users?role=STAFF&pageSize=100", {
      cache: "no-store",
    })
    if (!response.ok) {
      toast.error("Unable to load staff list.")
      setStaffOptions([])
      return
    }
    const data = (await response.json()) as { items?: StaffOption[] }
    setStaffOptions(data.items ?? [])
  }, [])

  React.useEffect(() => {
    void loadSchedules()
  }, [loadSchedules])

  React.useEffect(() => {
    void loadTemplates()
  }, [loadTemplates])

  React.useEffect(() => {
    void loadStaff()
  }, [loadStaff])

  React.useEffect(() => {
    setPagination((prev) =>
      prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 }
    )
  }, [sorting, staffFilter, startDateFilter])

  const handlePaginationChange = React.useCallback(
    (updater: PaginationState | ((prev: PaginationState) => PaginationState)) => {
      setPagination((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater
        if (next.pageSize !== prev.pageSize) {
          return { ...next, pageIndex: 0 }
        }
        return next
      })
    },
    []
  )

  const addBlock = (setter: React.Dispatch<React.SetStateAction<ShiftScheduleForm>>) => {
    setter((prev) => ({
      ...prev,
      blocks: [...prev.blocks, { templateId: "", repeatDays: 1 }],
    }))
  }

  const updateBlock = (
    setter: React.Dispatch<React.SetStateAction<ShiftScheduleForm>>,
    blockIndex: number,
    updater: (block: ShiftScheduleForm["blocks"][number]) => ShiftScheduleForm["blocks"][number]
  ) => {
    setter((prev) => ({
      ...prev,
      blocks: prev.blocks.map((block, index) =>
        index === blockIndex ? updater(block) : block
      ),
    }))
  }

  const removeBlock = (
    setter: React.Dispatch<React.SetStateAction<ShiftScheduleForm>>,
    blockIndex: number
  ) => {
    setter((prev) => ({
      ...prev,
      blocks: prev.blocks.filter((_, index) => index !== blockIndex),
    }))
  }

  const createSchedule = async () => {
    if (!newSchedule.isDefault && !newSchedule.staffIds.length) {
      toast.error("Select at least one staff member.")
      return
    }
    setSaving(true)
    clearCreateErrors()
    const response = await fetch("/api/shifts/schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newSchedule),
    })

    if (!response.ok) {
      const data = (await response.json()) as {
        error?: string
        details?: { fieldErrors?: Record<string, string[]> }
      }
      setCreateErrorsFromResponse(data)
      toast.error(data.error ?? "Unable to create shift schedule.")
      setSaving(false)
      return
    }

    toast.success("Shift schedule created.")
    setNewSchedule(defaultForm)
    setSaving(false)
    setCreateOpen(false)
    await loadSchedules()
  }

  const startEdit = React.useCallback(
    (schedule: ShiftScheduleRow) => {
      clearEditErrors()
      const assignments = schedule.assignments ?? []
      const assignmentStart = assignments[0]?.startDate
        ? toDateInputValue(assignments[0].startDate)
        : ""
      const assignmentEnd = assignments[0]?.endDate
        ? toDateInputValue(assignments[0].endDate)
        : ""
      setEditingSchedule(schedule)
      setEditSchedule({
        name: schedule.name ?? "",
        staffIds: assignments
          .map((assignment) => assignment.staffProfile?.user?.id)
          .filter(Boolean) as string[],
        isDefault: Boolean(schedule.isDefault),
        startDate: toDateInputValue(schedule.startDate),
        assignmentStartDate: assignmentStart || toDateInputValue(schedule.startDate),
        assignmentEndDate: assignmentEnd,
        weekOffDay1: schedule.weekOffDay1,
        weekOffDay2: schedule.weekOffDay2 ?? "",
        weekOff2Weeks:
          schedule.weekOffDay2 && (!schedule.weekOff2Weeks || !schedule.weekOff2Weeks.length)
            ? [1, 2, 3, 4, 5]
            : schedule.weekOff2Weeks ?? [],
        blocks: schedule.blocks.length
          ? schedule.blocks.map((block) => ({
              templateId: block.templateId,
              repeatDays: block.repeatDays,
            }))
          : [{ templateId: "", repeatDays: 1 }],
      })
      setEditOpen(true)
    },
    [clearEditErrors]
  )

  const saveEdit = async () => {
    if (!editingSchedule) return
    if (!editSchedule.isDefault && !editSchedule.staffIds.length) {
      toast.error("Select a staff member.")
      return
    }
    setSaving(true)
    const response = await fetch(`/api/shifts/schedules/${editingSchedule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editSchedule),
    })

    if (!response.ok) {
      const data = (await response.json()) as {
        error?: string
        details?: { fieldErrors?: Record<string, string[]> }
      }
      setEditErrorsFromResponse(data)
      toast.error(data.error ?? "Unable to update shift schedule.")
      setSaving(false)
      return
    }

    toast.success("Shift schedule updated.")
    setSaving(false)
    setEditOpen(false)
    setEditingSchedule(null)
    await loadSchedules()
  }

  const requestDelete = React.useCallback((schedule: ShiftScheduleRow) => {
    setDeleteTarget(schedule)
    setDeleteOpen(true)
  }, [])

  const confirmDelete = React.useCallback(async () => {
    if (!deleteTarget) return
    setDeleting(true)
    const response = await fetch(`/api/shifts/schedules/${deleteTarget.id}`, {
      method: "DELETE",
    })
    if (!response.ok) {
      const data = (await response.json()) as { error?: string }
      toast.error(data.error ?? "Unable to delete shift schedule.")
      setDeleting(false)
      return
    }
    toast.success("Shift schedule deleted.")
    setDeleting(false)
    setDeleteOpen(false)
    setDeleteTarget(null)
    await loadSchedules()
  }, [deleteTarget, loadSchedules])

  const columns = React.useMemo<ColumnDef<ShiftScheduleRow>[]>(
    () => [
      {
        accessorKey: "name",
        meta: { label: "Schedule" },
        header: ({ column }) => (
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm font-medium"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Schedule
            <SortIndicator value={column.getIsSorted()} />
          </button>
        ),
        cell: ({ row }) => (
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-medium">
                {row.original.name || "Shift schedule"}
              </span>
              {row.original.isDefault ? (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  Default
                </span>
              ) : null}
            </div>
            <span className="text-xs text-muted-foreground">
              {row.original.startDate
                ? formatDateForDisplay(row.original.startDate)
                : "-"}
            </span>
          </div>
        ),
      },
      {
        id: "staff",
        meta: { label: "Staff" },
        header: ({ column }) => (
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm font-medium"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Staff
            <SortIndicator value={column.getIsSorted()} />
          </button>
        ),
        accessorFn: (row) => summarizeAssignments(row),
        cell: ({ row }) => (
          <div className="flex flex-col gap-1 text-sm text-muted-foreground">
            <span>{summarizeAssignments(row.original)}</span>
            <span className="text-xs text-muted-foreground">
              {summarizeAssignmentRange(row.original)}
            </span>
          </div>
        ),
      },
      {
        id: "startDate",
        meta: { label: "Start" },
        header: ({ column }) => (
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm font-medium"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Start
            <SortIndicator value={column.getIsSorted()} />
          </button>
        ),
        accessorFn: (row) => row.startDate,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.startDate
              ? formatDateForDisplay(row.original.startDate)
              : "-"}
          </span>
        ),
      },
      {
        id: "weekOff",
        meta: { label: "Week off" },
        header: ({ column }) => (
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm font-medium"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Week off
            <SortIndicator value={column.getIsSorted()} />
          </button>
        ),
        accessorFn: (row) => summarizeWeekOff(row),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {summarizeWeekOff(row.original)}
          </span>
        ),
      },
      {
        id: "blocks",
        meta: { label: "Blocks" },
        header: ({ column }) => (
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm font-medium"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Blocks
            <SortIndicator value={column.getIsSorted()} />
          </button>
        ),
        accessorFn: (row) => summarizeBlocks(row.blocks),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {summarizeBlocks(row.original.blocks)}
          </span>
        ),
      },
      {
        accessorKey: "updatedAt",
        meta: { label: "Updated" },
        header: ({ column }) => (
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm font-medium"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Updated
            <SortIndicator value={column.getIsSorted()} />
          </button>
        ),
        cell: ({ row }) => formatDateForDisplay(row.original.updatedAt),
      },
      {
        id: "actions",
        header: "",
        enableHiding: false,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost">
                <MoreHorizontalIcon className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => startEdit(row.original)}>
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => requestDelete(row.original)}
                className="text-destructive"
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [requestDelete, startEdit]
  )

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: schedules,
    columns,
    state: {
      sorting,
      columnVisibility,
      pagination,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: handlePaginationChange,
    manualPagination: true,
    manualSorting: true,
    pageCount: totalPages,
    getCoreRowModel: getCoreRowModel(),
  })

  const renderScheduleForm = (
    form: ShiftScheduleForm,
    setForm: React.Dispatch<React.SetStateAction<ShiftScheduleForm>>,
    errors: Record<string, string>,
    allowMultiStaff: boolean
  ) => {
    const weekOff2Enabled = Boolean(form.weekOffDay2)
    return (
      <div className="grid gap-4">
        <FormField id="schedule-name" label="Schedule name" error={errors.name}>
          <Input
            id="schedule-name"
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
          />
        </FormField>
        <div className="flex items-center gap-2">
          <input
            id="schedule-default"
            type="checkbox"
            checked={form.isDefault}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                isDefault: event.target.checked,
                staffIds: event.target.checked ? [] : prev.staffIds,
              }))
            }
          />
          <Label htmlFor="schedule-default">Make this the default schedule</Label>
        </div>
        <FormField id="schedule-staff" label="Staff" error={errors.staffIds}>
          {form.isDefault ? (
            <div className="rounded-md border border-dashed border-input bg-background p-3 text-xs text-muted-foreground">
              Default schedules apply to all staff without an explicit schedule.
            </div>
          ) : allowMultiStaff ? (
            <div className="space-y-2 rounded-md border border-input bg-background p-3">
              <div className="text-xs text-muted-foreground">
                Select one or more staff members.
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {staffOptions.map((staff) => {
                  const label = staff.name?.trim() || staff.email
                  const checked = form.staffIds.includes(staff.id)
                  return (
                    <label key={staff.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            staffIds: event.target.checked
                              ? [...prev.staffIds, staff.id]
                              : prev.staffIds.filter((value) => value !== staff.id),
                          }))
                        }
                      />
                      <span>{label}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          ) : (
            <select
              id="schedule-staff"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.staffIds[0] ?? ""}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  staffIds: event.target.value ? [event.target.value] : [],
                }))
              }
            >
              <option value="">Select staff</option>
              {staffOptions.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.name?.trim() || staff.email}
                </option>
              ))}
            </select>
          )}
        </FormField>
        {!form.isDefault ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="schedule-assign-start"
              label="Assignment start date"
              error={errors.assignmentStartDate}
            >
              <Input
                id="schedule-assign-start"
                type="date"
                value={form.assignmentStartDate}
                min={today}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, assignmentStartDate: event.target.value }))
                }
              />
            </FormField>
            <FormField
              id="schedule-assign-end"
              label="Assignment end date"
              error={errors.assignmentEndDate}
            >
              <Input
                id="schedule-assign-end"
                type="date"
                value={form.assignmentEndDate}
                min={form.assignmentStartDate || today}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, assignmentEndDate: event.target.value }))
                }
              />
            </FormField>
          </div>
        ) : null}
        <FormField id="schedule-start" label="Start date" error={errors.startDate}>
          <Input
            id="schedule-start"
            type="date"
            value={form.startDate}
            min={today}
            onChange={(event) =>
              setForm((prev) => {
                const next = event.target.value
                return {
                  ...prev,
                  startDate: next,
                  assignmentStartDate:
                    !prev.assignmentStartDate || prev.assignmentStartDate === prev.startDate
                      ? next
                      : prev.assignmentStartDate,
                }
              })
            }
          />
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="schedule-weekoff-1" label="Week off day 1" error={errors.weekOffDay1}>
            <select
              id="schedule-weekoff-1"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.weekOffDay1}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  weekOffDay1: event.target.value as Weekday,
                }))
              }
            >
              {WEEKDAYS.map((day) => (
                <option key={day.value} value={day.value}>
                  {day.label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField id="schedule-weekoff-2" label="Week off day 2" error={errors.weekOffDay2}>
            <select
              id="schedule-weekoff-2"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.weekOffDay2}
              onChange={(event) => {
                const value = event.target.value as Weekday | ""
                setForm((prev) => ({
                  ...prev,
                  weekOffDay2: value,
                  weekOff2Weeks: value
                    ? prev.weekOff2Weeks.length
                      ? prev.weekOff2Weeks
                      : [1, 2, 3, 4, 5]
                    : [],
                }))
              }}
            >
              <option value="">None</option>
              {WEEKDAYS.map((day) => (
                <option key={day.value} value={day.value}>
                  {day.label}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        <div className="space-y-2 rounded-md border border-input bg-background p-3">
          <div className="flex items-center justify-between">
            <Label>Week off day 2 weeks</Label>
            <span className="text-xs text-muted-foreground">Weeks of the month.</span>
          </div>
          <div className="flex flex-wrap gap-3">
            {[1, 2, 3, 4, 5].map((week) => (
              <label key={week} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.weekOff2Weeks.includes(week)}
                  disabled={!weekOff2Enabled}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      weekOff2Weeks: event.target.checked
                        ? [...prev.weekOff2Weeks, week]
                        : prev.weekOff2Weeks.filter((value) => value !== week),
                    }))
                  }
                />
                Week {week}
              </label>
            ))}
          </div>
          {errors.weekOff2Weeks ? (
            <p className="text-xs text-destructive">{errors.weekOff2Weeks}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label>Shift blocks</Label>
            <span className="text-xs text-muted-foreground">
              Repeat days count ignores week off days.
            </span>
          </div>
          <div className="space-y-3">
            {form.blocks.map((block, index) => (
              <div
                key={`block-${index}`}
                className="grid gap-3 sm:grid-cols-[1fr_140px_auto] sm:items-end"
              >
                <FormField
                  id={`block-template-${index}`}
                  label={`Shift template ${index + 1}`}
                >
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={block.templateId}
                    onChange={(event) =>
                      updateBlock(setForm, index, (current) => ({
                        ...current,
                        templateId: event.target.value,
                      }))
                    }
                  >
                    <option value="">Select template</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField id={`block-repeat-${index}`} label="Repeat days">
                  <Input
                    type="number"
                    min={1}
                    value={block.repeatDays}
                    onChange={(event) =>
                      updateBlock(setForm, index, (current) => ({
                        ...current,
                        repeatDays: Number(event.target.value || 1),
                      }))
                    }
                  />
                </FormField>
                <Button variant="outline" onClick={() => removeBlock(setForm, index)}>
                  Remove
                </Button>
              </div>
            ))}
          </div>
          {errors.blocks ? <p className="text-xs text-destructive">{errors.blocks}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => addBlock(setForm)}>
              Add shift block
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Shift schedules</h1>
          <p className="text-sm text-muted-foreground">
            Assign shift templates in repeating blocks with week off rules.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>New schedule</Button>
      </div>

      <DataTableToolbar table={table} showSearch={false}>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-muted-foreground">Start date</label>
          <Input
            type="date"
            className="h-9 w-44"
            value={startDateFilter}
            onChange={(event) => setStartDateFilter(event.target.value)}
          />
          <select
            className="h-9 w-48 rounded-md border border-input bg-background px-3 text-sm"
            value={staffFilter}
            onChange={(event) => setStaffFilter(event.target.value)}
          >
            <option value="all">All staff</option>
            {staffOptions.map((staff) => (
              <option key={staff.id} value={staff.id}>
                {staff.name?.trim() || staff.email}
              </option>
            ))}
          </select>
        </div>
      </DataTableToolbar>

      <DataTable table={table} loading={loading} emptyMessage="No shift schedules found." />

      <DataTablePagination table={table} totalRows={totalRows} />

      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open)
          if (!open) {
            setDeleteTarget(null)
            setDeleting(false)
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete shift schedule</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `Delete "${deleteTarget.name ?? "Shift schedule"}"? This cannot be undone.`
                : "Delete this shift schedule? This cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>New shift schedule</DialogTitle>
            <DialogDescription>Define repeating blocks and week off rules.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            {renderScheduleForm(newSchedule, setNewSchedule, createErrors, true)}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createSchedule} disabled={saving}>
              {saving ? "Saving..." : "Create schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open)
          if (!open) {
            setEditingSchedule(null)
            clearEditErrors()
          }
        }}
      >
        <DialogContent className="max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit shift schedule</DialogTitle>
            <DialogDescription>Update schedule details and blocks.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            {renderScheduleForm(editSchedule, setEditSchedule, editErrors, true)}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={saving}>
              {saving ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
