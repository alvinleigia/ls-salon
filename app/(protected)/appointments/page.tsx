"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  ColumnDef,
  SortingState,
  VisibilityState,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table"
import {
  Inject,
  Month,
  ScheduleComponent,
  ViewDirective,
  ViewsDirective,
} from "@syncfusion/ej2-react-schedule"
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon, MoreHorizontalIcon } from "lucide-react"
import { toast } from "sonner"

import { DataTable, DataTablePagination, DataTableToolbar } from "@/components/data-table"
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
import { useFormErrors } from "@/hooks/use-form-errors"
import { useDateFormatter } from "@/hooks/use-date-formatter"
import { cn } from "@/lib/utils"
import type { ListResponse } from "@/types/api"
import type {
  AppointmentAvailabilityResult,
  AppointmentCustomerOption,
  AppointmentFormValues,
  AppointmentRow,
  AppointmentServiceOption,
  AppointmentStaffOption,
  AppointmentStatus,
} from "@/types/appointments"
import { AppointmentFormFields } from "./appointment-form-fields"
import {
  buildEndTimePreview,
  combineLocalDateTimeToISO,
  defaultAppointmentFormValues,
} from "./appointment-form-model"

type PaginationState = { pageIndex: number; pageSize: number }

type CalendarEvent = {
  Id: string
  Subject: string
  StartTime: Date
  EndTime: Date
  CategoryColor?: string
}

const APPOINTMENT_STATUS_OPTIONS: Array<AppointmentStatus | "all"> = [
  "all",
  "SCHEDULED",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELED",
  "NO_SHOW",
]

const STATUS_COLORS: Record<AppointmentStatus, string> = {
  SCHEDULED: "#0ea5e9",
  CONFIRMED: "#22c55e",
  IN_PROGRESS: "#f59e0b",
  COMPLETED: "#64748b",
  CANCELED: "#ef4444",
  NO_SHOW: "#e11d48",
}

const canRescheduleAppointment = (status: AppointmentStatus) =>
  status === "SCHEDULED" || status === "CONFIRMED"

const canCancelAppointment = (status: AppointmentStatus) =>
  status === "SCHEDULED" || status === "CONFIRMED" || status === "IN_PROGRESS"

const STATUS_BADGE_CLASS: Record<AppointmentStatus, string> = {
  SCHEDULED: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  CONFIRMED: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  IN_PROGRESS: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  COMPLETED: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  CANCELED: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  NO_SHOW: "bg-pink-500/15 text-pink-300 border-pink-500/30",
}

const SortIndicator = ({ value }: { value: false | "asc" | "desc" }) => {
  if (value === "asc") return <ArrowUpIcon className="h-4 w-4" />
  if (value === "desc") return <ArrowDownIcon className="h-4 w-4" />
  return <ArrowUpDownIcon className="h-4 w-4" />
}

const toDateInput = (value: Date) => {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, "0")
  const day = String(value.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

const toTimeInput = (value: Date) => {
  const hours = String(value.getHours()).padStart(2, "0")
  const minutes = String(value.getMinutes()).padStart(2, "0")
  return `${hours}:${minutes}`
}

export default function AppointmentsPage() {
  const router = useRouter()
  const { formatDate } = useDateFormatter()
  const scheduleRef = React.useRef<ScheduleComponent | null>(null)

  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)
  const [appointments, setAppointments] = React.useState<AppointmentRow[]>([])
  const [calendarAppointments, setCalendarAppointments] = React.useState<AppointmentRow[]>([])
  const [customers, setCustomers] = React.useState<AppointmentCustomerOption[]>([])
  const [staff, setStaff] = React.useState<AppointmentStaffOption[]>([])
  const [services, setServices] = React.useState<AppointmentServiceOption[]>([])
  const [totalRows, setTotalRows] = React.useState(0)

  const [search, setSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<AppointmentStatus | "all">("all")
  const [staffFilter, setStaffFilter] = React.useState<string>("all")
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({
    customer: true,
    service: true,
    staff: true,
    startAt: true,
    status: true,
  })
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })

  const [viewDates, setViewDates] = React.useState<Date[]>([])
  const [formOpen, setFormOpen] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [formMode, setFormMode] = React.useState<"create" | "edit" | "reschedule">("create")
  const [cancelConfirmOpen, setCancelConfirmOpen] = React.useState(false)
  const [cancelTarget, setCancelTarget] = React.useState<AppointmentRow | null>(null)
  const [formValues, setFormValues] = React.useState<AppointmentFormValues>(
    defaultAppointmentFormValues()
  )
  const [availabilityChecking, setAvailabilityChecking] = React.useState(false)
  const [availability, setAvailability] = React.useState<AppointmentAvailabilityResult | null>(
    null
  )

  const {
    errors,
    setErrorsFromResponse,
    clearErrors,
  } = useFormErrors()

  const totalPages = Math.max(1, Math.ceil(totalRows / pagination.pageSize))
  const selectedService = React.useMemo(
    () => services.find((service) => service.id === formValues.serviceId),
    [formValues.serviceId, services]
  )
  const endTimePreview = React.useMemo(
    () =>
      buildEndTimePreview(
        formValues.date,
        formValues.startTime,
        selectedService?.durationMinutes
      ),
    [formValues.date, formValues.startTime, selectedService?.durationMinutes]
  )

  const loadLookups = React.useCallback(async () => {
    const [customerRes, staffRes, serviceRes] = await Promise.all([
      fetch("/api/users?role=CUSTOMER&status=ACTIVE&page=1&pageSize=100", { cache: "no-store" }),
      fetch("/api/users?role=STAFF&status=ACTIVE&page=1&pageSize=100", { cache: "no-store" }),
      fetch("/api/services?status=ACTIVE&page=1&pageSize=100&sort=name&order=asc", {
        cache: "no-store",
      }),
    ])

    if (customerRes.ok) {
      const data = (await customerRes.json()) as {
        items?: Array<{ id: string; name: string | null; email: string }>
      }
      setCustomers(data.items ?? [])
    }

    if (staffRes.ok) {
      const data = (await staffRes.json()) as {
        items?: Array<{ id: string; name: string | null; email: string }>
      }
      setStaff(data.items ?? [])
    }

    if (serviceRes.ok) {
      const data = (await serviceRes.json()) as {
        items?: Array<{ id: string; name: string; durationMinutes: number }>
      }
      setServices(data.items ?? [])
    }
  }, [])

  const loadAppointments = React.useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set("page", String(pagination.pageIndex + 1))
    params.set("pageSize", String(pagination.pageSize))
    if (search.trim()) params.set("q", search.trim())
    if (statusFilter !== "all") params.set("status", statusFilter)
    if (staffFilter !== "all") params.set("staffId", staffFilter)
    if (sorting[0]) {
      params.set("sort", sorting[0].id)
      params.set("order", sorting[0].desc ? "desc" : "asc")
    }

    const response = await fetch(`/api/appointments?${params.toString()}`, {
      cache: "no-store",
    })
    if (!response.ok) {
      toast.error("Unable to load appointments.")
      setAppointments([])
      setTotalRows(0)
      setLoading(false)
      return
    }
    const data = (await response.json()) as ListResponse<AppointmentRow>
    setAppointments(data.items)
    setTotalRows(data.total)
    setLoading(false)
  }, [pagination.pageIndex, pagination.pageSize, search, sorting, staffFilter, statusFilter])

  const loadCalendarAppointments = React.useCallback(async () => {
    if (!viewDates.length) return

    const startDate = toDateInput(viewDates[0])
    const endDate = toDateInput(viewDates[viewDates.length - 1])
    const params = new URLSearchParams()
    params.set("page", "1")
    params.set("pageSize", "100")
    params.set("startDate", startDate)
    params.set("endDate", endDate)
    if (statusFilter !== "all") params.set("status", statusFilter)
    if (staffFilter !== "all") params.set("staffId", staffFilter)

    const response = await fetch(`/api/appointments?${params.toString()}`, {
      cache: "no-store",
    })
    if (!response.ok) {
      toast.error("Unable to load calendar appointments.")
      setCalendarAppointments([])
      return
    }
    const data = (await response.json()) as ListResponse<AppointmentRow>
    setCalendarAppointments(data.items)
  }, [staffFilter, statusFilter, viewDates])

  React.useEffect(() => {
    void loadLookups()
  }, [loadLookups])

  React.useEffect(() => {
    void loadAppointments()
  }, [loadAppointments])

  React.useEffect(() => {
    void loadCalendarAppointments()
  }, [loadCalendarAppointments])

  React.useEffect(() => {
    setPagination((prev) => (prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 }))
  }, [search, sorting, staffFilter, statusFilter])

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

  const openCreateDialog = React.useCallback(
    (seedDate?: Date) => {
      const base = defaultAppointmentFormValues()
      if (seedDate) {
        base.date = toDateInput(seedDate)
        base.startTime = "09:00"
      }
      setFormMode("create")
      setEditingId(null)
      setFormValues(base)
      setAvailability(null)
      setAvailabilityChecking(false)
      clearErrors()
      setFormOpen(true)
    },
    [clearErrors]
  )

  const openEditDialog = React.useCallback(
    (appointment: AppointmentRow, mode: "edit" | "reschedule" = "edit") => {
      const start = new Date(appointment.startAt)
      setFormMode(mode)
      setEditingId(appointment.id)
      setFormValues({
        customerId: appointment.customerId,
        serviceId: appointment.serviceId,
        staffId: appointment.staffProfile?.user?.id ?? "",
        date: toDateInput(start),
        startTime: toTimeInput(start),
        status: appointment.status,
      })
      setAvailability(null)
      setAvailabilityChecking(false)
      clearErrors()
      setFormOpen(true)
    },
    [clearErrors]
  )

  const submitForm = React.useCallback(async () => {
    if (!formValues.customerId || !formValues.serviceId || !formValues.staffId) {
      toast.error("Customer, service and staff are required.")
      return
    }
    if (!formValues.date || !formValues.startTime) {
      toast.error("Date and time are required.")
      return
    }
    if (availabilityChecking) {
      toast.error("Checking availability. Please wait.")
      return
    }
    if (availability && !availability.available) {
      toast.error(availability.reason ?? "Selected slot is not available.")
      return
    }

    setSaving(true)
    clearErrors()
    const payload = {
      customerId: formValues.customerId,
      serviceId: formValues.serviceId,
      staffId: formValues.staffId,
      startAt: combineLocalDateTimeToISO(formValues.date, formValues.startTime),
      status: formValues.status,
    }

    const response = await fetch(
      editingId ? `/api/appointments/${editingId}` : "/api/appointments",
      {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    )

    if (!response.ok) {
      const data = (await response.json()) as {
        error?: string
        details?: { fieldErrors?: Record<string, string[]> }
      }
      setErrorsFromResponse(data)
      toast.error(data.error ?? "Unable to save appointment.")
      setSaving(false)
      return
    }

    toast.success(editingId ? "Appointment updated." : "Appointment created.")
    setSaving(false)
    setFormOpen(false)
    await Promise.all([loadAppointments(), loadCalendarAppointments()])
  }, [
    availability,
    availabilityChecking,
    clearErrors,
    editingId,
    formValues,
    loadAppointments,
    loadCalendarAppointments,
    setErrorsFromResponse,
  ])

  React.useEffect(() => {
    if (!formOpen) return
    if (!formValues.staffId || !formValues.serviceId || !formValues.date || !formValues.startTime) {
      setAvailability(null)
      setAvailabilityChecking(false)
      return
    }

    const timer = setTimeout(async () => {
      setAvailabilityChecking(true)
      const response = await fetch("/api/appointments/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId: editingId ?? undefined,
          customerId: formValues.customerId || undefined,
          serviceId: formValues.serviceId,
          staffId: formValues.staffId,
          startAt: combineLocalDateTimeToISO(formValues.date, formValues.startTime),
        }),
      })
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string }
        setAvailability({
          available: false,
          reason: data.error ?? "Unable to verify slot availability.",
        })
        setAvailabilityChecking(false)
        return
      }
      const data = (await response.json()) as AppointmentAvailabilityResult
      setAvailability(data)
      setAvailabilityChecking(false)
    }, 250)

    return () => {
      clearTimeout(timer)
    }
  }, [editingId, formOpen, formValues])

  const confirmCancelAppointment = React.useCallback(async (appointmentId: string) => {
    setDeleting(true)
    const response = await fetch(`/api/appointments/${appointmentId}`, {
      method: "DELETE",
    })
    if (!response.ok) {
      const data = (await response.json()) as { error?: string }
      toast.error(data.error ?? "Unable to cancel appointment.")
      setDeleting(false)
      return
    }
    toast.success("Appointment canceled.")
    setDeleting(false)
    setCancelConfirmOpen(false)
    setCancelTarget(null)
    setFormOpen(false)
    await Promise.all([loadAppointments(), loadCalendarAppointments()])
  }, [loadAppointments, loadCalendarAppointments])

  const requestCancelAppointment = React.useCallback((appointment: AppointmentRow | null, id?: string) => {
    if (appointment) {
      setCancelTarget(appointment)
    } else if (id) {
      setCancelTarget((prev) =>
        prev?.id === id
          ? prev
          : appointments.find((item) => item.id === id) ?? null
      )
    }
    setCancelConfirmOpen(true)
  }, [appointments])

  const syncViewDates = React.useCallback(() => {
    const dates = scheduleRef.current?.getCurrentViewDates?.() ?? []
    if (dates.length) setViewDates(dates)
  }, [])

  const calendarEvents = React.useMemo<CalendarEvent[]>(
    () =>
      calendarAppointments.map((appointment) => {
        const customerLabel = appointment.customer?.name || appointment.customer?.email || "Customer"
        const serviceLabel = appointment.service?.name || "Service"
        const orderLabel = appointment.orderLine?.order
          ? ` [${appointment.orderLine.order.status}]`
          : ""
        return {
          Id: appointment.id,
          Subject: `${serviceLabel}${orderLabel} - ${customerLabel}`,
          StartTime: new Date(appointment.startAt),
          EndTime: new Date(appointment.endAt),
          CategoryColor: STATUS_COLORS[appointment.status],
        }
      }),
    [calendarAppointments]
  )

  const handleCellClick = React.useCallback(
    (args: { startTime?: Date }) => {
      if (!(args.startTime instanceof Date)) return
      openCreateDialog(args.startTime)
    },
    [openCreateDialog]
  )

  const handleEventClick = React.useCallback(
    (args: { event?: Record<string, unknown> }) => {
      const eventId = args.event?.Id as string | undefined
      if (!eventId) return
      const appointment = calendarAppointments.find((item) => item.id === eventId)
      if (!appointment) return
      router.push(`/appointments/${appointment.id}/edit`)
    },
    [calendarAppointments, router]
  )

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

  const columns = React.useMemo<ColumnDef<AppointmentRow>[]>(
    () => [
      {
        id: "customer",
        meta: { label: "Customer" },
        header: "Customer",
        accessorFn: (row) => row.customer?.name || row.customer?.email || "-",
      },
      {
        id: "service",
        meta: { label: "Service" },
        header: "Service",
        accessorFn: (row) => row.service?.name || "-",
      },
      {
        id: "staff",
        meta: { label: "Staff" },
        header: "Staff",
        accessorFn: (row) => row.staffProfile?.user?.name || row.staffProfile?.user?.email || "-",
      },
      {
        id: "order",
        meta: { label: "Order" },
        header: "Order",
        cell: ({ row }) => {
          const order = row.original.orderLine?.order
          if (!order) return "-"
          return `${order.status} (${order.id.slice(-6)})`
        },
      },
      {
        id: "startAt",
        accessorFn: (row) => row.startAt,
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
        cell: ({ row }) => formatDate(row.original.startAt),
      },
      {
        id: "status",
        accessorFn: (row) => row.status,
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
            className={cn(
              "inline-flex rounded-md border px-2 py-0.5 text-xs font-medium",
              STATUS_BADGE_CLASS[row.original.status]
            )}
          >
            {row.original.status}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        enableHiding: false,
        cell: ({ row }) => {
          const appointment = row.original
          const canReschedule = canRescheduleAppointment(appointment.status)
          const canCancel = canCancelAppointment(appointment.status)
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost">
                  <MoreHorizontalIcon className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => router.push(`/appointments/${appointment.id}/edit`)}>
                  Edit
                </DropdownMenuItem>
                {canReschedule ? (
                  <DropdownMenuItem onSelect={() => router.push(`/appointments/${appointment.id}/edit`)}>
                    Reschedule
                  </DropdownMenuItem>
                ) : null}
                {canCancel ? (
                  <DropdownMenuItem
                    className="text-destructive"
                    onSelect={() => requestCancelAppointment(appointment)}
                  >
                    Cancel appointment
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
      },
    ],
    [formatDate, requestCancelAppointment, router]
  )

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: appointments,
    columns,
    state: { sorting, columnVisibility, pagination, globalFilter: search },
    onSortingChange: setSorting,
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
          <h1 className="text-2xl font-semibold">Appointments</h1>
          <p className="text-sm text-muted-foreground">
            Create bookings from calendar cells or from the new appointment button.
          </p>
        </div>
        <Button onClick={() => router.push("/appointments/new")}>New appointment</Button>
      </div>

      <div className="rounded-xl border bg-card p-3 shadow-sm">
        <ScheduleComponent
          ref={scheduleRef}
          currentView="Month"
          showQuickInfo={false}
          readonly
          allowDragAndDrop={false}
          allowResizing={false}
          eventSettings={{
            dataSource: calendarEvents,
            fields: {
              id: "Id",
              subject: { name: "Subject" },
              startTime: { name: "StartTime" },
              endTime: { name: "EndTime" },
              categoryColor: { name: "CategoryColor" },
            },
          }}
          actionComplete={syncViewDates}
          created={syncViewDates}
          cellClick={handleCellClick}
          eventClick={handleEventClick}
          eventRendered={handleEventRendered}
          height="auto"
        >
          <ViewsDirective>
            <ViewDirective option="Month" />
          </ViewsDirective>
          <Inject services={[Month]} />
        </ScheduleComponent>
      </div>

      <DataTableToolbar table={table} searchPlaceholder="Search appointments">
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value as AppointmentStatus | "all")
          }
        >
          {APPOINTMENT_STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {status === "all" ? "All statuses" : status}
            </option>
          ))}
        </select>
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
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
      </DataTableToolbar>

      <DataTable table={table} loading={loading} emptyMessage="No appointments found." />
      <DataTablePagination table={table} totalRows={totalRows} />

      <Dialog
        open={cancelConfirmOpen}
        onOpenChange={(open) => {
          setCancelConfirmOpen(open)
          if (!open) {
            setCancelTarget(null)
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel appointment</DialogTitle>
            <DialogDescription>
              {cancelTarget
                ? `Cancel this appointment for ${cancelTarget.customer?.name || cancelTarget.customer?.email || "the customer"}?`
                : "Cancel this appointment?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCancelConfirmOpen(false)
                setCancelTarget(null)
              }}
              disabled={deleting}
            >
              Keep appointment
            </Button>
            <Button
              variant="destructive"
              onClick={() => (cancelTarget ? void confirmCancelAppointment(cancelTarget.id) : undefined)}
              disabled={deleting || !cancelTarget}
            >
              {deleting ? "Canceling..." : "Confirm cancel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) {
            setEditingId(null)
            setFormMode("create")
            clearErrors()
          }
        }}
      >
        <DialogContent className="max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {editingId
                ? formMode === "reschedule"
                  ? "Reschedule appointment"
                  : "Edit appointment"
                : "New appointment"}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? formMode === "reschedule"
                  ? "Update date and time for this booking."
                  : "Update appointment details, staff, service, and status."
                : "Use the same booking form whether you open from calendar or button."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            <AppointmentFormFields
              values={formValues}
              errors={errors}
              customers={customers}
              services={services}
              staff={staff}
              showStatus={Boolean(editingId)}
              disableParticipantFields={formMode === "reschedule"}
              onChange={setFormValues}
            />
            <div className="mt-3 text-xs text-muted-foreground">
              {endTimePreview
                ? `Expected end time: ${endTimePreview}`
                : "Select service, date and start time to calculate end time."}
            </div>
            <div className="mt-3 text-xs">
              {availabilityChecking ? (
                <p className="text-muted-foreground">Checking slot availability...</p>
              ) : availability ? (
                <p className={availability.available ? "text-green-500" : "text-destructive"}>
                  {availability.available
                    ? "Slot available"
                    : availability.reason ?? "Slot unavailable"}
                </p>
              ) : (
                <p className="text-muted-foreground">
                  Select staff, service, date and time to validate availability.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            {editingId && canCancelAppointment(formValues.status) ? (
              <Button
                variant="outline"
                onClick={() => requestCancelAppointment(null, editingId)}
                disabled={deleting}
              >
                {deleting ? "Canceling..." : "Cancel appointment"}
              </Button>
            ) : null}
            <Button onClick={submitForm} disabled={saving || availabilityChecking || availability?.available === false}>
              {saving ? "Saving..." : editingId ? "Save changes" : "Create appointment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
