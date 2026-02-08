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
import type { SupplierRow } from "@/types/inventory"

type SupplierFormValues = {
  name: string
  contactPerson: string
  email: string
  phone: string
  taxId: string
  leadTimeDays: number
  city: string
  country: string
  notes: string
  status: "ACTIVE" | "INACTIVE"
}

const defaultValues: SupplierFormValues = {
  name: "",
  contactPerson: "",
  email: "",
  phone: "",
  taxId: "",
  leadTimeDays: 0,
  city: "",
  country: "",
  notes: "",
  status: "ACTIVE",
}

type PaginationState = { pageIndex: number; pageSize: number }

const SortIndicator = ({ value }: { value: false | "asc" | "desc" }) => {
  if (value === "asc") return <ArrowUpIcon className="h-4 w-4" />
  if (value === "desc") return <ArrowDownIcon className="h-4 w-4" />
  return <ArrowUpDownIcon className="h-4 w-4" />
}

export default function InventorySuppliersPage() {
  const [items, setItems] = React.useState<SupplierRow[]>([])
  const [totalRows, setTotalRows] = React.useState(0)
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState("")
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize: 10 })
  const [formOpen, setFormOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<SupplierRow | null>(null)
  const [formValues, setFormValues] = React.useState<SupplierFormValues>(defaultValues)
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
    const response = await fetch(`/api/inventory/suppliers?${params.toString()}`)
    if (!response.ok) {
      toast.error("Unable to load suppliers.")
      setItems([])
      setTotalRows(0)
      setLoading(false)
      return
    }
    const data = (await response.json()) as ListResponse<SupplierRow>
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
      editing ? `/api/inventory/suppliers/${editing.id}` : "/api/inventory/suppliers",
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
      toast.error(data.error ?? "Unable to save supplier.")
      setSaving(false)
      return
    }
    toast.success(editing ? "Supplier updated." : "Supplier created.")
    setSaving(false)
    setFormOpen(false)
    setEditing(null)
    setFormValues(defaultValues)
    await loadItems()
  }

  const removeItem = React.useCallback(async (item: SupplierRow) => {
    const response = await fetch(`/api/inventory/suppliers/${item.id}`, { method: "DELETE" })
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string }
      toast.error(data.error ?? "Unable to delete supplier.")
      return
    }
    toast.success("Supplier deleted.")
    await loadItems()
  }, [loadItems])

  const columns = React.useMemo<ColumnDef<SupplierRow>[]>(
    () => [
      {
        accessorKey: "name",
        meta: { label: "Supplier" },
        header: ({ column }) => (
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm font-medium"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Supplier
            <SortIndicator value={column.getIsSorted()} />
          </button>
        ),
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.original.name}</span>
            <span className="text-xs text-muted-foreground">
              {row.original.contactPerson || row.original.email || "No contact"}
            </span>
          </div>
        ),
      },
      { accessorKey: "phone", meta: { label: "Phone" }, header: "Phone" },
      { accessorKey: "city", meta: { label: "City" }, header: "City" },
      { accessorKey: "leadTimeDays", meta: { label: "Lead days" }, header: "Lead days" },
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
                  contactPerson: row.original.contactPerson ?? "",
                  email: row.original.email ?? "",
                  phone: row.original.phone ?? "",
                  taxId: row.original.taxId ?? "",
                  leadTimeDays: row.original.leadTimeDays,
                  city: row.original.city ?? "",
                  country: row.original.country ?? "",
                  notes: "",
                  status: row.original.status,
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
          <h1 className="text-2xl font-semibold">Suppliers</h1>
          <p className="text-sm text-muted-foreground">
            Manage supplier master records for purchasing.
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
          New supplier
        </Button>
      </div>

      <DataTableToolbar table={table} searchPlaceholder="Search suppliers" />
      <DataTable table={table} loading={loading} emptyMessage="No suppliers found." />
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
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit supplier" : "New supplier"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <FormField id="sup-name" label="Name" error={errors.name}>
              <Input
                id="sup-name"
                value={formValues.name}
                onChange={(event) => setFormValues((prev) => ({ ...prev, name: event.target.value }))}
              />
            </FormField>
            <div className="grid gap-3 md:grid-cols-2">
              <FormField id="sup-contact" label="Contact person" error={errors.contactPerson}>
                <Input
                  id="sup-contact"
                  value={formValues.contactPerson}
                  onChange={(event) =>
                    setFormValues((prev) => ({ ...prev, contactPerson: event.target.value }))
                  }
                />
              </FormField>
              <FormField id="sup-email" label="Email" error={errors.email}>
                <Input
                  id="sup-email"
                  value={formValues.email}
                  onChange={(event) => setFormValues((prev) => ({ ...prev, email: event.target.value }))}
                />
              </FormField>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <FormField id="sup-phone" label="Phone" error={errors.phone}>
                <Input
                  id="sup-phone"
                  value={formValues.phone}
                  onChange={(event) => setFormValues((prev) => ({ ...prev, phone: event.target.value }))}
                />
              </FormField>
              <FormField id="sup-tax" label="Tax ID" error={errors.taxId}>
                <Input
                  id="sup-tax"
                  value={formValues.taxId}
                  onChange={(event) => setFormValues((prev) => ({ ...prev, taxId: event.target.value }))}
                />
              </FormField>
              <FormField id="sup-lead" label="Lead days" error={errors.leadTimeDays}>
                <Input
                  id="sup-lead"
                  type="number"
                  min={0}
                  value={formValues.leadTimeDays}
                  onChange={(event) =>
                    setFormValues((prev) => ({
                      ...prev,
                      leadTimeDays: Math.max(0, Number(event.target.value || 0)),
                    }))
                  }
                />
              </FormField>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <FormField id="sup-city" label="City" error={errors.city}>
                <Input
                  id="sup-city"
                  value={formValues.city}
                  onChange={(event) => setFormValues((prev) => ({ ...prev, city: event.target.value }))}
                />
              </FormField>
              <FormField id="sup-country" label="Country" error={errors.country}>
                <Input
                  id="sup-country"
                  value={formValues.country}
                  onChange={(event) => setFormValues((prev) => ({ ...prev, country: event.target.value }))}
                />
              </FormField>
            </div>
            <FormField id="sup-notes" label="Notes" error={errors.notes}>
              <Input
                id="sup-notes"
                value={formValues.notes}
                onChange={(event) => setFormValues((prev) => ({ ...prev, notes: event.target.value }))}
              />
            </FormField>
            <FormField id="sup-status" label="Status" error={errors.status}>
              <select
                id="sup-status"
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={formValues.status}
                onChange={(event) =>
                  setFormValues((prev) => ({
                    ...prev,
                    status: event.target.value as SupplierFormValues["status"],
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
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving..." : editing ? "Save changes" : "Create supplier"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
