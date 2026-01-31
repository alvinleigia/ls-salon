
"use client"

import * as React from "react"
import {
  ColumnDef,
  ColumnFiltersState,
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
import type { ListResponse } from "@/types/api"

type Weekday =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY"

type WorkingPeriod = {
  kind: "WORK" | "BREAK"
  startTime: string
  endTime: string
}

type WorkingDay = {
  day: Weekday
  isOpen: boolean
  periods: WorkingPeriod[]
}

type SettingsResponse = {
  settings?: {
    workingHours?: WorkingDay[]
  }
}

type ShiftTemplateBreak = {
  id?: string
  startTime: string
  endTime: string
  sortOrder?: number
}

type ShiftTemplateRow = {
  id: string
  name: string
  description: string | null
  color: string | null
  isActive: boolean
  startTime: string
  endTime: string
  breaks: ShiftTemplateBreak[]
  createdAt: string
  updatedAt: string
}

type ShiftTemplateForm = {
  name: string
  description: string
  color: string
  isActive: boolean
  startTime: string
  endTime: string
  breaks: ShiftTemplateBreak[]
}

type TemplateStatus = "ACTIVE" | "INACTIVE"

const statusOptions: TemplateStatus[] = ["ACTIVE", "INACTIVE"]

const defaultTemplateForm: ShiftTemplateForm = {
  name: "",
  description: "",
  color: "#2563eb",
  isActive: true,
  startTime: "09:00",
  endTime: "18:00",
  breaks: [],
}

const SortIndicator = ({ value }: { value: false | "asc" | "desc" }) => {
  if (value === "asc") return <ArrowUpIcon className="h-4 w-4" />
  if (value === "desc") return <ArrowDownIcon className="h-4 w-4" />
  return <ArrowUpDownIcon className="h-4 w-4" />
}

const summarizeBreaks = (breaks: ShiftTemplateBreak[]) => {
  if (!breaks.length) return "-"
  return breaks.map((item) => `${item.startTime}-${item.endTime}`).join(" - ")
}

export default function ShiftsPage() {
  type PaginationState = { pageIndex: number; pageSize: number }

  const [templates, setTemplates] = React.useState<ShiftTemplateRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [totalRows, setTotalRows] = React.useState(0)

  const [search, setSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<"all" | TemplateStatus>(
    "all"
  )

  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({
    name: true,
    status: true,
    shift: true,
    breaks: true,
    updatedAt: true,
  })
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 10 })

  const [createOpen, setCreateOpen] = React.useState(false)
  const [editOpen, setEditOpen] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<ShiftTemplateRow | null>(
    null
  )
  const [editingTemplate, setEditingTemplate] =
    React.useState<ShiftTemplateRow | null>(null)
  const [newTemplate, setNewTemplate] = React.useState<ShiftTemplateForm>(
    defaultTemplateForm
  )
  const [editTemplate, setEditTemplate] = React.useState<ShiftTemplateForm>(
    defaultTemplateForm
  )

  const [workingHours, setWorkingHours] = React.useState<WorkingDay[]>([])

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

  const loadSettings = React.useCallback(async () => {
    const response = await fetch("/api/settings", { cache: "no-store" })
    if (!response.ok) {
      return
    }
    const data = (await response.json()) as SettingsResponse
    setWorkingHours(data.settings?.workingHours ?? [])
  }, [])

  const loadTemplates = React.useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set("page", String(pagination.pageIndex + 1))
    params.set("pageSize", String(pagination.pageSize))
    if (search) {
      params.set("q", search)
    }
    if (statusFilter !== "all") {
      params.set("status", statusFilter)
    }
    if (sorting[0]) {
      params.set("sort", sorting[0].id)
      params.set("order", sorting[0].desc ? "desc" : "asc")
    }

    const response = await fetch(`/api/shifts/templates?${params.toString()}`)
    if (!response.ok) {
      toast.error("Unable to load shift templates.")
      setTemplates([])
      setTotalRows(0)
      setLoading(false)
      return
    }
    const data = (await response.json()) as ListResponse<ShiftTemplateRow>
    setTemplates(data.items)
    setTotalRows(data.total)
    setLoading(false)
  }, [pagination.pageIndex, pagination.pageSize, search, sorting, statusFilter])

  React.useEffect(() => {
    void loadTemplates()
  }, [loadTemplates])

  React.useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  React.useEffect(() => {
    setPagination((prev) =>
      prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 }
    )
  }, [search, sorting, statusFilter])

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
  const getWorkingHoursBounds = React.useCallback(() => {
    let minStart = "23:59"
    let maxEnd = "00:00"
    let hasPeriod = false
    for (const day of workingHours) {
      if (!day.isOpen) continue
      for (const period of day.periods) {
        if (period.kind !== "WORK") continue
        hasPeriod = true
        if (period.startTime < minStart) minStart = period.startTime
        if (period.endTime > maxEnd) maxEnd = period.endTime
      }
    }
    if (!hasPeriod || minStart >= maxEnd) {
      return { minStart: "00:00", maxEnd: "23:59" }
    }
    return { minStart, maxEnd }
  }, [workingHours])

  const addBreak = (
    setter: React.Dispatch<React.SetStateAction<ShiftTemplateForm>>
  ) => {
    setter((prev) => ({
      ...prev,
      breaks: [
        ...prev.breaks,
        {
          startTime: "12:00",
          endTime: "13:00",
        },
      ],
    }))
  }

  const updateBreak = (
    setter: React.Dispatch<React.SetStateAction<ShiftTemplateForm>>,
    breakIndex: number,
    updater: (period: ShiftTemplateBreak) => ShiftTemplateBreak
  ) => {
    setter((prev) => ({
      ...prev,
      breaks: prev.breaks.map((period, index) =>
        index === breakIndex ? updater(period) : period
      ),
    }))
  }

  const removeBreak = (
    setter: React.Dispatch<React.SetStateAction<ShiftTemplateForm>>,
    breakIndex: number
  ) => {
    setter((prev) => ({
      ...prev,
      breaks: prev.breaks.filter((_, index) => index !== breakIndex),
    }))
  }

  const createTemplate = async () => {
    if (!newTemplate.name.trim()) {
      toast.error("Template name is required.")
      return
    }
    setSaving(true)
    clearCreateErrors()
    const response = await fetch("/api/shifts/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newTemplate.name.trim(),
        description: newTemplate.description.trim() || null,
        color: newTemplate.color || null,
        isActive: newTemplate.isActive,
        startTime: newTemplate.startTime,
        endTime: newTemplate.endTime,
        breaks: newTemplate.breaks.map((period, index) => ({
          startTime: period.startTime,
          endTime: period.endTime,
          sortOrder: period.sortOrder ?? index,
        })),
      }),
    })

    if (!response.ok) {
      const data = (await response.json()) as {
        error?: string
        details?: { fieldErrors?: Record<string, string[]> }
      }
      setCreateErrorsFromResponse(data)
      toast.error(data.error ?? "Unable to create shift template.")
      setSaving(false)
      return
    }

    toast.success("Shift template created.")
    setNewTemplate(defaultTemplateForm)
    setSaving(false)
    setCreateOpen(false)
    await loadTemplates()
  }

  const startEdit = React.useCallback(
    (template: ShiftTemplateRow) => {
      clearEditErrors()
      setEditingTemplate(template)
      setEditTemplate({
        name: template.name,
        description: template.description ?? "",
        color: template.color ?? "#2563eb",
        isActive: template.isActive,
        startTime: template.startTime,
        endTime: template.endTime,
        breaks:
          template.breaks?.length > 0
            ? template.breaks.map((period) => ({
                startTime: period.startTime,
                endTime: period.endTime,
                sortOrder: period.sortOrder,
              }))
            : [],
      })
      setEditOpen(true)
    },
    [clearEditErrors]
  )

  const saveEdit = async () => {
    if (!editingTemplate) return
    if (!editTemplate.name.trim()) {
      toast.error("Template name is required.")
      return
    }
    setSaving(true)
    const response = await fetch(`/api/shifts/templates/${editingTemplate.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editTemplate.name.trim(),
        description: editTemplate.description.trim() || null,
        color: editTemplate.color || null,
        isActive: editTemplate.isActive,
        startTime: editTemplate.startTime,
        endTime: editTemplate.endTime,
        breaks: editTemplate.breaks.map((period, index) => ({
          startTime: period.startTime,
          endTime: period.endTime,
          sortOrder: period.sortOrder ?? index,
        })),
      }),
    })

    if (!response.ok) {
      const data = (await response.json()) as {
        error?: string
        details?: { fieldErrors?: Record<string, string[]> }
      }
      setEditErrorsFromResponse(data)
      toast.error(data.error ?? "Unable to update shift template.")
      setSaving(false)
      return
    }

    toast.success("Shift template updated.")
    setSaving(false)
    setEditOpen(false)
    setEditingTemplate(null)
    await loadTemplates()
  }

  const requestDelete = React.useCallback((template: ShiftTemplateRow) => {
    setDeleteTarget(template)
    setDeleteOpen(true)
  }, [])

  const confirmDelete = React.useCallback(async () => {
    if (!deleteTarget) return
    setDeleting(true)
    const response = await fetch(`/api/shifts/templates/${deleteTarget.id}`, {
      method: "DELETE",
    })
    if (!response.ok) {
      const data = (await response.json()) as { error?: string }
      toast.error(data.error ?? "Unable to delete shift template.")
      setDeleting(false)
      return
    }
    toast.success("Shift template deleted.")
    setDeleting(false)
    setDeleteOpen(false)
    setDeleteTarget(null)
    await loadTemplates()
  }, [deleteTarget, loadTemplates])
  const columns = React.useMemo<ColumnDef<ShiftTemplateRow>[]>(
    () => [
      {
        accessorKey: "name",
        meta: { label: "Template" },
        header: ({ column }) => (
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm font-medium"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Template
            <SortIndicator value={column.getIsSorted()} />
          </button>
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: row.original.color ?? "#64748b" }}
            />
            <div className="flex flex-col">
              <span className="font-medium">{row.original.name}</span>
              {row.original.description ? (
                <span className="text-xs text-muted-foreground">
                  {row.original.description}
                </span>
              ) : null}
            </div>
          </div>
        ),
      },
      {
        id: "shift",
        meta: { label: "Shift" },
        header: ({ column }) => (
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm font-medium"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Shift
            <SortIndicator value={column.getIsSorted()} />
          </button>
        ),
        accessorFn: (row) => `${row.startTime}-${row.endTime}`,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.startTime}-{row.original.endTime}
          </span>
        ),
      },
      {
        id: "breaks",
        meta: { label: "Breaks" },
        header: ({ column }) => (
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm font-medium"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Breaks
            <SortIndicator value={column.getIsSorted()} />
          </button>
        ),
        accessorFn: (row) => summarizeBreaks(row.breaks),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {summarizeBreaks(row.original.breaks)}
          </span>
        ),
      },
      {
        accessorKey: "isActive",
        meta: { label: "Status" },
        header: ({ column }) => (
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm font-medium"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Status
            <SortIndicator value={column.getIsSorted()} />
          </button>
        ),
        cell: ({ row }) => (
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
              row.original.isActive
                ? "bg-emerald-500/10 text-emerald-500"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {row.original.isActive ? "Active" : "Inactive"}
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
        cell: ({ row }) => new Date(row.original.updatedAt).toLocaleDateString(),
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
    data: templates,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter: search,
      pagination,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setSearch,
    onPaginationChange: handlePaginationChange,
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    pageCount: totalPages,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Shifts</h1>
          <p className="text-sm text-muted-foreground">
            Create shift templates with a single shift range and optional breaks.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>New template</Button>
      </div>

      <DataTableToolbar table={table} searchPlaceholder="Search templates">
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value as "all" | TemplateStatus)
          }
        >
          <option value="all">All statuses</option>
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {status === "ACTIVE" ? "Active" : "Inactive"}
            </option>
          ))}
        </select>
      </DataTableToolbar>

      <DataTable table={table} loading={loading} emptyMessage="No shift templates found." />

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
            <DialogTitle>Delete shift template</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `Delete "${deleteTarget.name}"? This cannot be undone.`
                : "Delete this shift template? This cannot be undone."}
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
            <DialogTitle>New shift template</DialogTitle>
            <DialogDescription>Define a reusable schedule.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            <div className="grid gap-4">
              <FormField id="template-name" label="Name" error={createErrors.name}>
                <Input
                  id="template-name"
                  value={newTemplate.name}
                  onChange={(event) =>
                    setNewTemplate((prev) => ({ ...prev, name: event.target.value }))
                  }
                />
              </FormField>
              <FormField
                id="template-description"
                label="Description"
                error={createErrors.description}
              >
                <Input
                  id="template-description"
                  value={newTemplate.description}
                  onChange={(event) =>
                    setNewTemplate((prev) => ({
                      ...prev,
                      description: event.target.value,
                    }))
                  }
                />
              </FormField>
              <FormField id="template-color" label="Color" error={createErrors.color}>
                <Input
                  id="template-color"
                  type="color"
                  value={newTemplate.color}
                  onChange={(event) =>
                    setNewTemplate((prev) => ({
                      ...prev,
                      color: event.target.value,
                    }))
                  }
                />
              </FormField>
              <FormField id="template-status" label="Status" error={createErrors.isActive}>
                <select
                  id="template-status"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={newTemplate.isActive ? "ACTIVE" : "INACTIVE"}
                  onChange={(event) =>
                    setNewTemplate((prev) => ({
                      ...prev,
                      isActive: event.target.value === "ACTIVE",
                    }))
                  }
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status === "ACTIVE" ? "Active" : "Inactive"}
                    </option>
                  ))}
                </select>
              </FormField>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>Shift time</Label>
                  <span className="text-xs text-muted-foreground">
                    Working hours bounds: {getWorkingHoursBounds().minStart} -{" "}
                    {getWorkingHoursBounds().maxEnd}
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField
                    id="create-shift-start"
                    label="Start"
                    error={createErrors.startTime}
                  >
                    <Input
                      type="time"
                      min={getWorkingHoursBounds().minStart}
                      max={getWorkingHoursBounds().maxEnd}
                      value={newTemplate.startTime}
                      onChange={(event) =>
                        setNewTemplate((prev) => ({
                          ...prev,
                          startTime: event.target.value,
                        }))
                      }
                    />
                  </FormField>
                  <FormField id="create-shift-end" label="End" error={createErrors.endTime}>
                    <Input
                      type="time"
                      min={getWorkingHoursBounds().minStart}
                      max={getWorkingHoursBounds().maxEnd}
                      value={newTemplate.endTime}
                      onChange={(event) =>
                        setNewTemplate((prev) => ({
                          ...prev,
                          endTime: event.target.value,
                        }))
                      }
                    />
                  </FormField>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>Breaks</Label>
                  <span className="text-xs text-muted-foreground">
                    Optional breaks within the shift range.
                  </span>
                </div>
                <div className="space-y-3">
                  {newTemplate.breaks.map((period, index) => (
                    <div
                      key={`create-break-${index}`}
                      className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
                    >
                      <FormField id={`create-break-start-${index}`} label="Start">
                        <Input
                          type="time"
                          min={newTemplate.startTime}
                          max={newTemplate.endTime}
                          value={period.startTime}
                          onChange={(event) =>
                            updateBreak(setNewTemplate, index, (current) => ({
                              ...current,
                              startTime: event.target.value,
                            }))
                          }
                        />
                      </FormField>
                      <FormField id={`create-break-end-${index}`} label="End">
                        <Input
                          type="time"
                          min={newTemplate.startTime}
                          max={newTemplate.endTime}
                          value={period.endTime}
                          onChange={(event) =>
                            updateBreak(setNewTemplate, index, (current) => ({
                              ...current,
                              endTime: event.target.value,
                            }))
                          }
                        />
                      </FormField>
                      <Button
                        variant="outline"
                        onClick={() => removeBreak(setNewTemplate, index)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
                {createErrors.breaks ? (
                  <p className="text-xs text-destructive">{createErrors.breaks}</p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => addBreak(setNewTemplate)}>
                    Add break
                  </Button>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createTemplate} disabled={saving}>
              {saving ? "Saving..." : "Create template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open)
          if (!open) {
            setEditingTemplate(null)
            clearEditErrors()
          }
        }}
      >
        <DialogContent className="max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit shift template</DialogTitle>
            <DialogDescription>Update template details, shift time, and breaks.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            <div className="grid gap-4">
              <FormField id="edit-template-name" label="Name" error={editErrors.name}>
                <Input
                  id="edit-template-name"
                  value={editTemplate.name}
                  onChange={(event) =>
                    setEditTemplate((prev) => ({ ...prev, name: event.target.value }))
                  }
                />
              </FormField>
              <FormField
                id="edit-template-description"
                label="Description"
                error={editErrors.description}
              >
                <Input
                  id="edit-template-description"
                  value={editTemplate.description}
                  onChange={(event) =>
                    setEditTemplate((prev) => ({
                      ...prev,
                      description: event.target.value,
                    }))
                  }
                />
              </FormField>
              <FormField id="edit-template-color" label="Color" error={editErrors.color}>
                <Input
                  id="edit-template-color"
                  type="color"
                  value={editTemplate.color}
                  onChange={(event) =>
                    setEditTemplate((prev) => ({
                      ...prev,
                      color: event.target.value,
                    }))
                  }
                />
              </FormField>
              <FormField id="edit-template-status" label="Status" error={editErrors.isActive}>
                <select
                  id="edit-template-status"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={editTemplate.isActive ? "ACTIVE" : "INACTIVE"}
                  onChange={(event) =>
                    setEditTemplate((prev) => ({
                      ...prev,
                      isActive: event.target.value === "ACTIVE",
                    }))
                  }
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status === "ACTIVE" ? "Active" : "Inactive"}
                    </option>
                  ))}
                </select>
              </FormField>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>Shift time</Label>
                  <span className="text-xs text-muted-foreground">
                    Working hours bounds: {getWorkingHoursBounds().minStart} -{" "}
                    {getWorkingHoursBounds().maxEnd}
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField id="edit-shift-start" label="Start" error={editErrors.startTime}>
                    <Input
                      type="time"
                      min={getWorkingHoursBounds().minStart}
                      max={getWorkingHoursBounds().maxEnd}
                      value={editTemplate.startTime}
                      onChange={(event) =>
                        setEditTemplate((prev) => ({
                          ...prev,
                          startTime: event.target.value,
                        }))
                      }
                    />
                  </FormField>
                  <FormField id="edit-shift-end" label="End" error={editErrors.endTime}>
                    <Input
                      type="time"
                      min={getWorkingHoursBounds().minStart}
                      max={getWorkingHoursBounds().maxEnd}
                      value={editTemplate.endTime}
                      onChange={(event) =>
                        setEditTemplate((prev) => ({
                          ...prev,
                          endTime: event.target.value,
                        }))
                      }
                    />
                  </FormField>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>Breaks</Label>
                  <span className="text-xs text-muted-foreground">
                    Optional breaks within the shift range.
                  </span>
                </div>
                <div className="space-y-3">
                  {editTemplate.breaks.map((period, index) => (
                    <div
                      key={`edit-break-${index}`}
                      className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
                    >
                      <FormField id={`edit-break-start-${index}`} label="Start">
                        <Input
                          type="time"
                          min={editTemplate.startTime}
                          max={editTemplate.endTime}
                          value={period.startTime}
                          onChange={(event) =>
                            updateBreak(setEditTemplate, index, (current) => ({
                              ...current,
                              startTime: event.target.value,
                            }))
                          }
                        />
                      </FormField>
                      <FormField id={`edit-break-end-${index}`} label="End">
                        <Input
                          type="time"
                          min={editTemplate.startTime}
                          max={editTemplate.endTime}
                          value={period.endTime}
                          onChange={(event) =>
                            updateBreak(setEditTemplate, index, (current) => ({
                              ...current,
                              endTime: event.target.value,
                            }))
                          }
                        />
                      </FormField>
                      <Button
                        variant="outline"
                        onClick={() => removeBreak(setEditTemplate, index)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
                {editErrors.breaks ? (
                  <p className="text-xs text-destructive">{editErrors.breaks}</p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => addBreak(setEditTemplate)}>
                    Add break
                  </Button>
                </div>
              </div>
            </div>
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
