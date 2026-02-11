"use client"

import * as React from "react"
import {
  ColumnDef,
  SortingState,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon, PlusIcon } from "lucide-react"
import { toast } from "sonner"

import { DataTable, DataTablePagination, DataTableToolbar } from "@/components/data-table"
import { FormField } from "@/components/form-field"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useFormErrors } from "@/hooks/use-form-errors"
import type { ListResponse } from "@/types/api"
import type { InventoryCategoryRow } from "@/types/inventory"

type CategoryFormValues = {
  name: string
  description: string
  status: "ACTIVE" | "INACTIVE"
  sortOrder: number
}

const defaultValues: CategoryFormValues = {
  name: "",
  description: "",
  status: "ACTIVE",
  sortOrder: 0,
}

type PaginationState = { pageIndex: number; pageSize: number }

const SortIndicator = ({ value }: { value: false | "asc" | "desc" }) => {
  if (value === "asc") return <ArrowUpIcon className="h-4 w-4" />
  if (value === "desc") return <ArrowDownIcon className="h-4 w-4" />
  return <ArrowUpDownIcon className="h-4 w-4" />
}

export default function InventoryCategoriesPage() {
  const [items, setItems] = React.useState<InventoryCategoryRow[]>([])
  const [totalRows, setTotalRows] = React.useState(0)
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState("")
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize: 10 })
  const [formOpen, setFormOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<InventoryCategoryRow | null>(null)
  const [formValues, setFormValues] = React.useState<CategoryFormValues>(defaultValues)
  const [saving, setSaving] = React.useState(false)
  const { errors, setErrorsFromResponse, clearErrors } = useFormErrors()

  const loadItems = React.useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set("page", String(pagination.pageIndex + 1))
    params.set("pageSize", String(pagination.pageSize))
    if (search.trim()) params.set("q", search.trim())
    if (sorting[0]) {
      params.set("sort", sorting[0].id)
      params.set("order", sorting[0].desc ? "desc" : "asc")
    }
    const response = await fetch(`/api/inventory/categories?${params.toString()}`)
    if (!response.ok) {
      toast.error("Unable to load categories.")
      setItems([])
      setTotalRows(0)
      setLoading(false)
      return
    }
    const data = (await response.json()) as ListResponse<InventoryCategoryRow>
    setItems(data.items)
    setTotalRows(data.total)
    setLoading(false)
  }, [pagination.pageIndex, pagination.pageSize, search, sorting])

  React.useEffect(() => {
    void loadItems()
  }, [loadItems])

  const save = async () => {
    setSaving(true)
    clearErrors()
    const response = await fetch(
      editing ? `/api/inventory/categories/${editing.id}` : "/api/inventory/categories",
      {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formValues),
      }
    )
    if (!response.ok) {
      const data = (await response.json()) as {
        error?: string
        details?: { fieldErrors?: Record<string, string[]> }
      }
      setErrorsFromResponse(data)
      toast.error(data.error ?? "Unable to save category.")
      setSaving(false)
      return
    }
    toast.success(editing ? "Category updated." : "Category created.")
    setSaving(false)
    setFormOpen(false)
    setEditing(null)
    setFormValues(defaultValues)
    await loadItems()
  }

  const removeItem = React.useCallback(async (item: InventoryCategoryRow) => {
    const response = await fetch(`/api/inventory/categories/${item.id}`, { method: "DELETE" })
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string }
      toast.error(data.error ?? "Unable to delete category.")
      return
    }
    toast.success("Category deleted.")
    await loadItems()
  }, [loadItems])

  const columns = React.useMemo<ColumnDef<InventoryCategoryRow>[]>(
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
              <span className="text-xs text-muted-foreground">{row.original.description}</span>
            ) : null}
          </div>
        ),
      },
      { accessorKey: "sortOrder", meta: { label: "Order" }, header: "Order" },
      {
        accessorKey: "status",
        meta: { label: "Status" },
        header: "Status",
        cell: ({ row }) => (row.original.status === "ACTIVE" ? "Active" : "Inactive"),
      },
      {
        id: "actions",
        meta: { label: "Actions" },
        header: "",
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditing(row.original)
                setFormValues({
                  name: row.original.name,
                  description: row.original.description ?? "",
                  status: row.original.status,
                  sortOrder: row.original.sortOrder,
                })
                clearErrors()
                setFormOpen(true)
              }}
            >
              Edit
            </Button>
            <Button variant="outline" size="sm" onClick={() => void removeItem(row.original)}>
              Delete
            </Button>
          </div>
        ),
      },
    ],
    [clearErrors, removeItem]
  )

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: items,
    columns,
    state: { sorting, pagination, globalFilter: search },
    onSortingChange: setSorting,
    onGlobalFilterChange: setSearch,
    onPaginationChange: (updater) => {
      setPagination((prev) =>
        typeof updater === "function" ? (updater(prev as never) as PaginationState) : updater
      )
    },
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    pageCount: Math.max(1, Math.ceil(totalRows / pagination.pageSize)),
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Inventory categories</h1>
          <p className="text-sm text-muted-foreground">
            Organize products for stock and purchasing.
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null)
            setFormValues(defaultValues)
            clearErrors()
            setFormOpen(true)
          }}
        >
          <PlusIcon className="mr-2 h-4 w-4" />
          New category
        </Button>
      </div>

      <DataTableToolbar table={table} searchPlaceholder="Search categories" />
      <DataTable table={table} loading={loading} emptyMessage="No categories found." />
      <DataTablePagination table={table} totalRows={totalRows} />

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) {
            setEditing(null)
            setFormValues(defaultValues)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit category" : "New category"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <FormField id="cat-name" label="Name" error={errors.name}>
              <Input
                id="cat-name"
                value={formValues.name}
                onChange={(event) => setFormValues((prev) => ({ ...prev, name: event.target.value }))}
              />
            </FormField>
            <FormField id="cat-description" label="Description" error={errors.description}>
              <Input
                id="cat-description"
                value={formValues.description}
                onChange={(event) =>
                  setFormValues((prev) => ({ ...prev, description: event.target.value }))
                }
              />
            </FormField>
            <FormField id="cat-order" label="Sort order" error={errors.sortOrder}>
              <Input
                id="cat-order"
                type="number"
                min={0}
                value={formValues.sortOrder}
                onChange={(event) =>
                  setFormValues((prev) => ({
                    ...prev,
                    sortOrder: Math.max(0, Number(event.target.value || 0)),
                  }))
                }
              />
            </FormField>
            <FormField id="cat-status" label="Status" error={errors.status}>
              <select
                id="cat-status"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={formValues.status}
                onChange={(event) =>
                  setFormValues((prev) => ({
                    ...prev,
                    status: event.target.value as CategoryFormValues["status"],
                  }))
                }
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} loading={saving} loadingText="Saving...">
              {editing ? "Save changes" : "Create category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
