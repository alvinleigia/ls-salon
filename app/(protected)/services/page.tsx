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
import {
  DataTable,
  DataTablePagination,
  DataTableToolbar,
} from "@/components/data-table"
import { useFormErrors } from "@/hooks/use-form-errors"
import type { AppSettingsPayload, TaxRow } from "@/types/scheduling"
import type { ListResponse } from "@/types/api"
import type {
  CategoryOption,
  ServiceFormValues,
  ServiceOption,
  ServiceRow,
  ServiceStatus,
} from "@/types/services"
import { ServiceFormFields } from "./service-form-fields"
import {
  defaultServiceFormValues,
  serviceStatusOptions,
} from "./service-form-model"

const SortIndicator = ({ value }: { value: false | "asc" | "desc" }) => {
  if (value === "asc") return <ArrowUpIcon className="h-4 w-4" />
  if (value === "desc") return <ArrowDownIcon className="h-4 w-4" />
  return <ArrowUpDownIcon className="h-4 w-4" />
}

export default function ServicesPage() {
  type PaginationState = { pageIndex: number; pageSize: number }

  const [services, setServices] = React.useState<ServiceRow[]>([])
  const [categories, setCategories] = React.useState<CategoryOption[]>([])
  const [serviceOptions, setServiceOptions] = React.useState<ServiceOption[]>([])
  const [taxOptions, setTaxOptions] = React.useState<TaxRow[]>([])
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
    type: true,
  })
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 10 })

  const [createOpen, setCreateOpen] = React.useState(false)
  const [editOpen, setEditOpen] = React.useState(false)
  const [editingService, setEditingService] = React.useState<ServiceRow | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<ServiceRow | null>(null)
  const [deleting, setDeleting] = React.useState(false)

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

  const [newService, setNewService] = React.useState<ServiceFormValues>(
    defaultServiceFormValues
  )
  const [newPackageQuery, setNewPackageQuery] = React.useState("")

  const [editValues, setEditValues] = React.useState<ServiceFormValues>(
    defaultServiceFormValues
  )
  const [editPackageQuery, setEditPackageQuery] = React.useState("")

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
    const data = (await response.json()) as { settings?: AppSettingsPayload }
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

  const loadServiceOptions = React.useCallback(async () => {
    const params = new URLSearchParams()
    params.set("page", "1")
    params.set("pageSize", "100")
    params.set("sort", "name")
    params.set("order", "asc")
    params.set("status", "ACTIVE")
    params.set("type", "STANDARD")
    const response = await fetch(`/api/services?${params.toString()}`, {
      cache: "no-store",
    })
    if (!response.ok) {
      setServiceOptions([])
      return
    }
    const data = (await response.json()) as ListResponse<ServiceRow>
    setServiceOptions(
      data.items.map((item) => ({ id: item.id, name: item.name }))
    )
  }, [])

  const loadTaxOptions = React.useCallback(async () => {
    const response = await fetch("/api/settings/taxes?page=1&pageSize=100", {
      cache: "no-store",
    })
    if (!response.ok) {
      setTaxOptions([])
      return
    }
    const data = (await response.json()) as ListResponse<TaxRow>
    setTaxOptions(data.items)
  }, [])

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
    void loadServiceOptions()
  }, [loadServiceOptions])

  React.useEffect(() => {
    void loadTaxOptions()
  }, [loadTaxOptions])

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
        type: newService.type,
        packageItemIds:
          newService.type === "PACKAGE" ? newService.packageItemIds : [],
        taxIds: newService.taxIds,
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
    setNewService(defaultServiceFormValues)
    setNewPackageQuery("")
    setSaving(false)
    setCreateOpen(false)
    await loadServices()
  }

  const startEdit = React.useCallback((service: ServiceRow) => {
    setEditingService(service)
    clearEditErrors()
    setEditValues({
      name: service.name,
      description: service.description ?? "",
      categoryId: service.category.id,
      durationMinutes: service.durationMinutes,
      price: (service.priceCents / 100).toFixed(2),
      status: service.status,
      type: service.type ?? "STANDARD",
      packageItemIds:
        service.packageItems?.map((item) => item.itemService.id) ?? [],
      taxIds: service.taxIds ?? [],
    })
    setEditPackageQuery("")
    setEditOpen(true)
  }, [clearEditErrors])

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
        type: editValues.type,
        packageItemIds:
          editValues.type === "PACKAGE" ? editValues.packageItemIds : [],
        taxIds: editValues.taxIds,
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

  const requestDelete = React.useCallback((service: ServiceRow) => {
    setDeleteTarget(service)
    setDeleteOpen(true)
  }, [])

  const confirmDelete = React.useCallback(async () => {
    if (!deleteTarget) return
    setDeleting(true)
    const response = await fetch(`/api/services/${deleteTarget.id}`, {
      method: "DELETE",
    })
    if (!response.ok) {
      const data = (await response.json()) as { error?: string }
      toast.error(data.error ?? "Unable to delete service.")
      setDeleting(false)
      return
    }
    toast.success("Service deleted.")
    setDeleting(false)
    setDeleteOpen(false)
    setDeleteTarget(null)
    await loadServices()
  }, [deleteTarget, loadServices])

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
        accessorKey: "type",
        meta: { label: "Type" },
        header: ({ column }) => (
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm font-medium"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Type
            <SortIndicator value={column.getIsSorted()} />
          </button>
        ),
        cell: ({ row }) =>
          row.original.type === "PACKAGE" ? "Package" : "Standard",
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
    [formatPrice, requestDelete, startEdit]
  )

  // eslint-disable-next-line react-hooks/incompatible-library
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
          {serviceStatusOptions.map((status) => (
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
            <DialogTitle>Delete service</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `Delete "${deleteTarget.name}"? This cannot be undone.`
                : "Delete this service? This cannot be undone."}
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
            <DialogTitle>New service</DialogTitle>
            <DialogDescription>Create a service offering.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            <ServiceFormFields
              mode="create"
              values={newService}
              errors={createErrors}
              categories={categories}
              serviceOptions={serviceOptions}
              taxOptions={taxOptions}
              packageQuery={newPackageQuery}
              onPackageQueryChange={setNewPackageQuery}
              onChange={setNewService}
            />
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
        <DialogContent className="max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit service</DialogTitle>
            <DialogDescription>Update service details.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            <ServiceFormFields
              mode="edit"
              values={editValues}
              errors={editErrors}
              categories={categories}
              serviceOptions={serviceOptions}
              taxOptions={taxOptions}
              packageQuery={editPackageQuery}
              onPackageQueryChange={setEditPackageQuery}
              onChange={setEditValues}
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
