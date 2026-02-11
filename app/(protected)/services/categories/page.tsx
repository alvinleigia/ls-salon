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
import {
  DataTable,
  DataTablePagination,
  DataTableToolbar,
} from "@/components/data-table"
import { useFormErrors } from "@/hooks/use-form-errors"
import { useDateFormatter } from "@/hooks/use-date-formatter"
import type { ListResponse } from "@/types/api"
import type { CategoryFormValues, CategoryRow, CategoryStatus } from "@/types/services"
import { CategoryFormFields } from "./category-form-fields"
import {
  categoryStatusOptions,
  defaultCategoryFormValues,
} from "./category-form-model"

const SortIndicator = ({ value }: { value: false | "asc" | "desc" }) => {
  if (value === "asc") return <ArrowUpIcon className="h-4 w-4" />
  if (value === "desc") return <ArrowDownIcon className="h-4 w-4" />
  return <ArrowUpDownIcon className="h-4 w-4" />
}

export default function ServiceCategoriesPage() {
  const { formatDate } = useDateFormatter()
  type PaginationState = { pageIndex: number; pageSize: number }

  const [categories, setCategories] = React.useState<CategoryRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [totalRows, setTotalRows] = React.useState(0)

  const [search, setSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<"all" | CategoryStatus>(
    "all"
  )

  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({
    name: true,
    status: true,
    sortOrder: true,
  })
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 10 })

  const [createOpen, setCreateOpen] = React.useState(false)
  const [editOpen, setEditOpen] = React.useState(false)
  const [editingCategory, setEditingCategory] = React.useState<CategoryRow | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<CategoryRow | null>(null)
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

  const [newCategory, setNewCategory] = React.useState<CategoryFormValues>(
    defaultCategoryFormValues
  )

  const [editValues, setEditValues] = React.useState<CategoryFormValues>(
    defaultCategoryFormValues
  )

  const totalPages = Math.max(1, Math.ceil(totalRows / pagination.pageSize))

  const loadCategories = React.useCallback(async () => {
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
    const response = await fetch(`/api/service-categories?${params.toString()}`)
    if (!response.ok) {
      toast.error("Unable to load categories.")
      setCategories([])
      setTotalRows(0)
      setLoading(false)
      return
    }
    const data = (await response.json()) as ListResponse<CategoryRow>
    setCategories(data.items)
    setTotalRows(data.total)
    setLoading(false)
  }, [
    pagination.pageIndex,
    pagination.pageSize,
    search,
    sorting,
    statusFilter,
  ])

  React.useEffect(() => {
    void loadCategories()
  }, [loadCategories])

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

  const createCategory = async () => {
    setSaving(true)
    clearCreateErrors()
    const response = await fetch("/api/service-categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newCategory),
    })

    if (!response.ok) {
      const data = (await response.json()) as {
        error?: string
        details?: { fieldErrors?: Record<string, string[]> }
      }
      setCreateErrorsFromResponse(data)
      toast.error(data.error ?? "Unable to create category.")
      setSaving(false)
      return
    }

    toast.success("Category created.")
    setNewCategory(defaultCategoryFormValues)
    setSaving(false)
    setCreateOpen(false)
    await loadCategories()
  }

  const startEdit = React.useCallback((category: CategoryRow) => {
    setEditingCategory(category)
    clearEditErrors()
    setEditValues({
      name: category.name,
      description: category.description ?? "",
      status: category.status,
      sortOrder: category.sortOrder,
    })
    setEditOpen(true)
  }, [clearEditErrors])

  const saveEdit = async () => {
    if (!editingCategory) return
    setSaving(true)
    const response = await fetch(`/api/service-categories/${editingCategory.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editValues),
    })

    if (!response.ok) {
      const data = (await response.json()) as {
        error?: string
        details?: { fieldErrors?: Record<string, string[]> }
      }
      setEditErrorsFromResponse(data)
      toast.error(data.error ?? "Unable to update category.")
      setSaving(false)
      return
    }

    toast.success("Category updated.")
    setSaving(false)
    setEditOpen(false)
    setEditingCategory(null)
    await loadCategories()
  }

  const requestDelete = React.useCallback((category: CategoryRow) => {
    setDeleteTarget(category)
    setDeleteOpen(true)
  }, [])

  const confirmDelete = React.useCallback(async () => {
    if (!deleteTarget) return
    setDeleting(true)
    const response = await fetch(`/api/service-categories/${deleteTarget.id}`, {
      method: "DELETE",
    })
    if (!response.ok) {
      const data = (await response.json()) as { error?: string }
      toast.error(data.error ?? "Unable to delete category.")
      setDeleting(false)
      return
    }
    toast.success("Category deleted.")
    setDeleting(false)
    setDeleteOpen(false)
    setDeleteTarget(null)
    await loadCategories()
  }, [deleteTarget, loadCategories])

  const columns = React.useMemo<ColumnDef<CategoryRow>[]>(
    () => [
      {
        accessorKey: "name",
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
        accessorKey: "sortOrder",
        meta: { label: "Order" },
        header: ({ column }) => (
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm font-medium"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Order
            <SortIndicator value={column.getIsSorted()} />
          </button>
        ),
      },
      {
        accessorKey: "createdAt",
        meta: { label: "Created" },
        header: ({ column }) => (
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm font-medium"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Created
            <SortIndicator value={column.getIsSorted()} />
          </button>
        ),
        cell: ({ row }) => formatDate(row.original.createdAt),
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
    data: categories,
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
          <h1 className="text-2xl font-semibold">Service categories</h1>
          <p className="text-sm text-muted-foreground">
            Organize services for booking and pricing.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>New category</Button>
      </div>

      <DataTableToolbar table={table} searchPlaceholder="Search categories">
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value as "all" | CategoryStatus)
          }
        >
          <option value="all">All statuses</option>
          {categoryStatusOptions.map((status) => (
            <option key={status} value={status}>
              {status === "ACTIVE" ? "Active" : "Inactive"}
            </option>
          ))}
        </select>
      </DataTableToolbar>

      <DataTable table={table} loading={loading} emptyMessage="No categories found." />

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
            <DialogTitle>Delete category</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `Delete "${deleteTarget.name}"? This cannot be undone.`
                : "Delete this category? This cannot be undone."}
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
            <DialogTitle>New category</DialogTitle>
            <DialogDescription>Create a service category.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            <CategoryFormFields
              mode="create"
              values={newCategory}
              errors={createErrors}
              onChange={setNewCategory}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createCategory} loading={saving} loadingText="Saving...">
              Create category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open)
          if (!open) {
            setEditingCategory(null)
            clearEditErrors()
          }
        }}
      >
        <DialogContent className="max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit category</DialogTitle>
            <DialogDescription>Update category details.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            <CategoryFormFields
              mode="edit"
              values={editValues}
              errors={editErrors}
              onChange={setEditValues}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveEdit} loading={saving} loadingText="Saving...">
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
