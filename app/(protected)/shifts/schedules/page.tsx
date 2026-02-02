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
import {
  DataTable,
  DataTablePagination,
  DataTableToolbar,
} from "@/components/data-table"
import { useFormErrors } from "@/hooks/use-form-errors"
import { formatDateForDisplay, toISODate } from "@/lib/date"
import type { ListResponse } from "@/types/api"
import { WEEKDAY_OPTIONS } from "@/types/scheduling"
import type {
  ShiftSchedule,
  ShiftScheduleBlock,
  ShiftScheduleForm,
  ShiftTemplateOption,
  StaffOption,
} from "@/types/shifts"
import { ScheduleFormFields } from "./schedule-form-fields"
import { createDefaultScheduleForm } from "./schedule-form-model"

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

const summarizeWeekOff = (schedule: ShiftSchedule) => {
  const day1 =
    WEEKDAY_OPTIONS.find((item) => item.value === schedule.weekOffDay1)?.label ??
    schedule.weekOffDay1
  if (!schedule.weekOffDay2) {
    return day1
  }
  const day2 =
    WEEKDAY_OPTIONS.find((item) => item.value === schedule.weekOffDay2)?.label ??
    schedule.weekOffDay2
  const weeks =
    schedule.weekOff2Weeks?.length ? ` (weeks ${schedule.weekOff2Weeks.join(", ")})` : ""
  return `${day1} + ${day2}${weeks}`
}

const summarizeAssignments = (schedule: ShiftSchedule) => {
  if (schedule.isDefault) return "All staff"
  const assignments = schedule.assignments ?? []
  const names = assignments
    .map((assignment) => assignment.staffProfile?.user?.name || assignment.staffProfile?.user?.email)
    .filter(Boolean) as string[]
  if (!names.length) return "-"
  if (names.length <= 2) return names.join(", ")
  return `${names.slice(0, 2).join(", ")} +${names.length - 2}`
}

const summarizeAssignmentRange = (schedule: ShiftSchedule) => {
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

  const [schedules, setSchedules] = React.useState<ShiftSchedule[]>([])
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
  const [deleteTarget, setDeleteTarget] = React.useState<ShiftSchedule | null>(null)
  const [editingSchedule, setEditingSchedule] = React.useState<ShiftSchedule | null>(null)

  const today = React.useMemo(() => toISODate(new Date()), [])
  const defaultForm = React.useMemo(() => createDefaultScheduleForm(today), [today])

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
    const data = (await response.json()) as ListResponse<ShiftSchedule>
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
    (schedule: ShiftSchedule) => {
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

  const requestDelete = React.useCallback((schedule: ShiftSchedule) => {
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

  const columns = React.useMemo<ColumnDef<ShiftSchedule>[]>(
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
            <ScheduleFormFields
              mode="create"
              form={newSchedule}
              setForm={setNewSchedule}
              errors={createErrors}
              allowMultiStaff
              today={today}
              staffOptions={staffOptions}
              templates={templates}
            />
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
            <ScheduleFormFields
              mode="edit"
              form={editSchedule}
              setForm={setEditSchedule}
              errors={editErrors}
              allowMultiStaff
              today={today}
              staffOptions={staffOptions}
              templates={templates}
            />
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
