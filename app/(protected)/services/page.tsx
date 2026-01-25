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
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  MoreHorizontalIcon,
} from "lucide-react"
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
import { FormField } from "@/components/form-field"
import { useFormErrors } from "@/hooks/use-form-errors"
import type { ListResponse } from "@/types/api"

type ServiceStatus = "ACTIVE" | "INACTIVE"

type ServiceRow = {
  id: string
  name: string
  description: string | null
  durationMinutes: number
  priceCents: number
  status: ServiceStatus
  createdAt: string
  category: { id: string; name: string }
}

type CategoryOption = { id: string; name: string; status: "ACTIVE" | "INACTIVE" }

const statusOptions: ServiceStatus[] = ["ACTIVE", "INACTIVE"]

const SortIndicator = ({ value }: { value: false | "asc" | "desc" }) => {
  if (value === "asc") return <ArrowUpIcon className="h-4 w-4" />
  if (value === "desc") return <ArrowDownIcon className="h-4 w-4" />
  return <ArrowUpDownIcon className="h-4 w-4" />
}

export default function ServicesPage() {
  type PaginationState = { pageIndex: number; pageSize: number }

  const [services, setServices] = React.useState<ServiceRow[]>([])
  const [categories, setCategories] = React.useState<CategoryOption[]>([])
  const [settings, setSettings] = React.useState({
    locale: "en-US",
    currency: "USD",
  })
  const [loading, setLoading] = React.useState(true)
  const [totalRows, setTotalRows] = React.useState(0)

  const [search, setSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<"all" | ServiceStatus>("all")
  const [categoryFilter, setCategoryFilter] = React.useState("all")

  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({
    name: true,
    category: true,
    durationMinutes: true,
    priceCents: true,
    status: true,
  })
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 10 })

  const [createOpen, setCreateOpen] = React.useState(false)
  const [editOpen, setEditOpen] = React.useState(false)
  const [editingService, setEditingService] = React.useState<ServiceRow | null>(null)
  const [saving, setSaving] = React.useState(false)

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

  const [newService, setNewService] = React.useState({
    name: "",
    description: "",
    categoryId: "",
    durationMinutes: 60,
    price: "0.00",
    status: "ACTIVE" as ServiceStatus,
  })

  const [editValues, setEditValues] = React.useState({
    name: "",
    description: "",
    categoryId: "",
    durationMinutes: 60,
    price: "0.00",
    status: "ACTIVE" as ServiceStatus,
  })

  const totalPages = Math.max(1, Math.ceil(totalRows / pagination.pageSize))

  const loadCategories = React.useCallback(async () => {
    const response = await fetch(
      "/api/service-categories?page=1&pageSize=100&sort=sortOrder&order=asc",
      { cache: "no-store" }
    )
    if (!response.ok) {
      setCategories([])
      return
    }
    const data = (await response.json()) as ListResponse<CategoryOption>
    setCategories(data.items)
  }, [])

  const loadSettings = React.useCallback(async () => {
    const response = await fetch("/api/settings", { cache: "no-store" })
    if (!response.ok) {
      return
    }
    const data = (await response.json()) as {
      settings?: { locale?: string; currency?: string }
    }
    if (data.settings?.locale && data.settings?.currency) {
      setSettings({
        locale: data.settings.locale,
        currency: data.settings.currency,
      })
    }
  }, [])

  const loadServices = React.useCallback(async () => {
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
    if (categoryFilter !== "all") {
      params.set("categoryId", categoryFilter)
    }
    if (sorting[0]) {
      params.set("sort", sorting[0].id)
      params.set("order", sorting[0].desc ? "desc" : "asc")
    }
    const response = await fetch(`/api/services?${params.toString()}`)
    if (!response.ok) {
      toast.error("Unable to load services.")
      setServices([])
      setTotalRows(0)
      setLoading(false)
      return
    }
    const data = (await response.json()) as ListResponse<ServiceRow>
    setServices(data.items)
    setTotalRows(data.total)
    setLoading(false)
  }, [
    pagination.pageIndex,
    pagination.pageSize,
    search,
    statusFilter,
    categoryFilter,
    sorting,
  ])

  React.useEffect(() => {
    void loadCategories()
  }, [loadCategories])

  React.useEffect(() => {
    void loadServices()
  }, [loadServices])

  React.useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  React.useEffect(() => {
    setPagination((prev) =>
      prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 }
    )
  }, [search, statusFilter, categoryFilter, sorting])

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

  const priceToCents = (value: string) => {
    const normalized = value.replace(/[^0-9.]/g, "")
    const parsed = Number.parseFloat(normalized)
    if (Number.isNaN(parsed)) return 0
    return Math.round(parsed * 100)
  }

  const formatPrice = React.useCallback(
    (cents: number) =>
      new Intl.NumberFormat(settings.locale, {
        style: "currency",
        currency: settings.currency,
        maximumFractionDigits: 2,
      }).format(cents / 100),
    [settings.currency, settings.locale]
  )

  const createService = async () => {
    setSaving(true)
    clearCreateErrors()
    const response = await fetch("/api/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newService.name,
        description: newService.description,
        categoryId: newService.categoryId,
        durationMinutes: Number(newService.durationMinutes),
        priceCents: priceToCents(newService.price),
        status: newService.status,
      }),
    })

    if (!response.ok) {
      const data = (await response.json()) as {
        error?: string
        details?: { fieldErrors?: Record<string, string[]> }
      }
      setCreateErrorsFromResponse(data)
      toast.error(data.error ?? "Unable to create service.")
      setSaving(false)
      return
    }

    toast.success("Service created.")
    setNewService({
      name: "",
      description: "",
      categoryId: "",
      durationMinutes: 60,
      price: "0.00",
      status: "ACTIVE",
    })
    setSaving(false)
    setCreateOpen(false)
    await loadServices()
  }

  const startEdit = (service: ServiceRow) => {
    setEditingService(service)
    clearEditErrors()
    setEditValues({
      name: service.name,
      description: service.description ?? "",
      categoryId: service.category.id,
      durationMinutes: service.durationMinutes,
      price: (service.priceCents / 100).toFixed(2),
      status: service.status,
    })
    setEditOpen(true)
  }

  const saveEdit = async () => {
    if (!editingService) return
    setSaving(true)
    const response = await fetch(`/api/services/${editingService.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editValues.name,
        description: editValues.description,
        categoryId: editValues.categoryId,
        durationMinutes: Number(editValues.durationMinutes),
        priceCents: priceToCents(editValues.price),
        status: editValues.status,
      }),
    })

    if (!response.ok) {
      const data = (await response.json()) as {
        error?: string
        details?: { fieldErrors?: Record<string, string[]> }
      }
      setEditErrorsFromResponse(data)
      toast.error(data.error ?? "Unable to update service.")
      setSaving(false)
      return
    }

    toast.success("Service updated.")
    setSaving(false)
    setEditOpen(false)
    setEditingService(null)
    await loadServices()
  }

  const columns = React.useMemo<ColumnDef<ServiceRow>[]>(
    () => [
      {
        accessorKey: "name",
        meta: { label: "Service" },
        header: ({ column }) => (
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm font-medium"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Service
            <SortIndicator value={column.getIsSorted()} />
          </button>
        ),
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.original.name}</span>
            {row.original.description ? (
              <span className="text-xs text-muted-foreground">
                {row.original.description}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        id: "category",
        accessorFn: (row) => row.category.name,
        meta: { label: "Category" },
        header: ({ column }) => (
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm font-medium"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Category
            <SortIndicator value={column.getIsSorted()} />
          </button>
        ),
        cell: ({ row }) => row.original.category.name,
      },
      {
        accessorKey: "durationMinutes",
        meta: { label: "Duration" },
        header: ({ column }) => (
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm font-medium"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Duration
            <SortIndicator value={column.getIsSorted()} />
          </button>
        ),
        cell: ({ row }) => `${row.original.durationMinutes} min`,
      },
      {
        accessorKey: "priceCents",
        meta: { label: "Price" },
        header: ({ column }) => (
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm font-medium"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Price
            <SortIndicator value={column.getIsSorted()} />
          </button>
        ),
        cell: ({ row }) => formatPrice(row.original.priceCents),
      },
      {
        accessorKey: "status",
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
              row.original.status === "ACTIVE"
                ? "bg-emerald-500/10 text-emerald-500"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {row.original.status === "ACTIVE" ? "Active" : "Inactive"}
          </span>
        ),
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
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [formatPrice]
  )

  const table = useReactTable({
    data: services,
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
          <h1 className="text-2xl font-semibold">Services</h1>
          <p className="text-sm text-muted-foreground">
            Manage services, pricing, and durations.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>New service</Button>
      </div>

      <DataTableToolbar table={table} searchPlaceholder="Search services">
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value as "all" | ServiceStatus)
          }
        >
          <option value="all">All statuses</option>
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {status === "ACTIVE" ? "Active" : "Inactive"}
            </option>
          ))}
        </select>
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
        >
          <option value="all">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </DataTableToolbar>

      <DataTable table={table} loading={loading} emptyMessage="No services found." />

      <DataTablePagination table={table} totalRows={totalRows} />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New service</DialogTitle>
            <DialogDescription>Create a service offering.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <FormField id="service-name" label="Name" error={createErrors.name}>
              <Input
                id="service-name"
                value={newService.name}
                onChange={(event) =>
                  setNewService((prev) => ({ ...prev, name: event.target.value }))
                }
              />
            </FormField>
            <FormField
              id="service-description"
              label="Description"
              error={createErrors.description}
            >
              <Input
                id="service-description"
                value={newService.description}
                onChange={(event) =>
                  setNewService((prev) => ({
                    ...prev,
                    description: event.target.value,
                  }))
                }
              />
            </FormField>
            <FormField
              id="service-category"
              label="Category"
              error={createErrors.categoryId}
            >
              <select
                id="service-category"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={newService.categoryId}
                onChange={(event) =>
                  setNewService((prev) => ({
                    ...prev,
                    categoryId: event.target.value,
                  }))
                }
              >
                <option value="">Select a category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField
              id="service-duration"
              label="Duration (minutes)"
              error={createErrors.durationMinutes}
            >
              <Input
                id="service-duration"
                type="number"
                min={5}
                value={newService.durationMinutes}
                onChange={(event) =>
                  setNewService((prev) => ({
                    ...prev,
                    durationMinutes: Number(event.target.value) || 0,
                  }))
                }
              />
            </FormField>
            <FormField id="service-price" label="Price" error={createErrors.priceCents}>
              <Input
                id="service-price"
                inputMode="decimal"
                value={newService.price}
                onChange={(event) =>
                  setNewService((prev) => ({
                    ...prev,
                    price: event.target.value,
                  }))
                }
              />
            </FormField>
            <FormField id="service-status" label="Status" error={createErrors.status}>
              <select
                id="service-status"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={newService.status}
                onChange={(event) =>
                  setNewService((prev) => ({
                    ...prev,
                    status: event.target.value as ServiceStatus,
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createService} disabled={saving}>
              {saving ? "Saving..." : "Create service"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open)
          if (!open) {
            setEditingService(null)
            clearEditErrors()
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit service</DialogTitle>
            <DialogDescription>Update service details.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <FormField id="edit-service-name" label="Name" error={editErrors.name}>
              <Input
                id="edit-service-name"
                value={editValues.name}
                onChange={(event) =>
                  setEditValues((prev) => ({ ...prev, name: event.target.value }))
                }
              />
            </FormField>
            <FormField
              id="edit-service-description"
              label="Description"
              error={editErrors.description}
            >
              <Input
                id="edit-service-description"
                value={editValues.description}
                onChange={(event) =>
                  setEditValues((prev) => ({
                    ...prev,
                    description: event.target.value,
                  }))
                }
              />
            </FormField>
            <FormField
              id="edit-service-category"
              label="Category"
              error={editErrors.categoryId}
            >
              <select
                id="edit-service-category"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={editValues.categoryId}
                onChange={(event) =>
                  setEditValues((prev) => ({
                    ...prev,
                    categoryId: event.target.value,
                  }))
                }
              >
                <option value="">Select a category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField
              id="edit-service-duration"
              label="Duration (minutes)"
              error={editErrors.durationMinutes}
            >
              <Input
                id="edit-service-duration"
                type="number"
                min={5}
                value={editValues.durationMinutes}
                onChange={(event) =>
                  setEditValues((prev) => ({
                    ...prev,
                    durationMinutes: Number(event.target.value) || 0,
                  }))
                }
              />
            </FormField>
            <FormField id="edit-service-price" label="Price" error={editErrors.priceCents}>
              <Input
                id="edit-service-price"
                inputMode="decimal"
                value={editValues.price}
                onChange={(event) =>
                  setEditValues((prev) => ({
                    ...prev,
                    price: event.target.value,
                  }))
                }
              />
            </FormField>
            <FormField id="edit-service-status" label="Status" error={editErrors.status}>
              <select
                id="edit-service-status"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={editValues.status}
                onChange={(event) =>
                  setEditValues((prev) => ({
                    ...prev,
                    status: event.target.value as ServiceStatus,
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
