"use client"

import * as React from "react"
import {
  ColumnDef,
  SortingState,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table"
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
import { formatCurrencyFromCents } from "@/lib/formatting"
import type { ListResponse } from "@/types/api"
import type {
  InventoryCategoryOption,
  InventoryProductFormValues,
  InventoryProductRow,
  SupplierOption,
} from "@/types/inventory"
import type { AppSettingsPayload, TaxRow } from "@/types/scheduling"
import { ProductFormFields } from "./product-form-fields"
import { defaultInventoryProductFormValues } from "./product-form-model"

type PaginationState = { pageIndex: number; pageSize: number }

const SortIndicator = ({ value }: { value: false | "asc" | "desc" }) => {
  if (value === "asc") return <ArrowUpIcon className="h-4 w-4" />
  if (value === "desc") return <ArrowDownIcon className="h-4 w-4" />
  return <ArrowUpDownIcon className="h-4 w-4" />
}

export default function InventoryProductsPage() {
  const [items, setItems] = React.useState<InventoryProductRow[]>([])
  const [categories, setCategories] = React.useState<InventoryCategoryOption[]>([])
  const [suppliers, setSuppliers] = React.useState<SupplierOption[]>([])
  const [taxes, setTaxes] = React.useState<TaxRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [totalRows, setTotalRows] = React.useState(0)
  const [search, setSearch] = React.useState("")
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize: 10 })
  const [settings, setSettings] = React.useState<
    Required<
      Pick<
        AppSettingsPayload,
        "locale" | "currency" | "currencySymbolPlacement" | "numberFormat"
      >
    >
  >({
    locale: "en-US",
    currency: "USD",
    currencySymbolPlacement: "BEFORE",
    numberFormat: "US_UK",
  })

  const [formOpen, setFormOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<InventoryProductRow | null>(null)
  const [formValues, setFormValues] = React.useState<InventoryProductFormValues>(
    defaultInventoryProductFormValues
  )
  const [saving, setSaving] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<InventoryProductRow | null>(null)
  const [deleting, setDeleting] = React.useState(false)
  const { errors, setErrorsFromResponse, clearErrors } = useFormErrors()

  const parseMoney = (value: string) => {
    const normalized = value.replace(/[^0-9.]/g, "")
    const parsed = Number.parseFloat(normalized)
    if (Number.isNaN(parsed)) return 0
    return Math.round(parsed * 100)
  }

  const formatMoney = React.useCallback(
    (cents: number) => formatCurrencyFromCents(cents, settings),
    [settings]
  )

  const loadProducts = React.useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set("page", String(pagination.pageIndex + 1))
    params.set("pageSize", String(pagination.pageSize))
    if (search.trim()) params.set("q", search.trim())
    if (sorting[0]) {
      params.set("sort", sorting[0].id)
      params.set("order", sorting[0].desc ? "desc" : "asc")
    }

    const response = await fetch(`/api/inventory/products?${params.toString()}`)
    if (!response.ok) {
      toast.error("Unable to load products.")
      setItems([])
      setTotalRows(0)
      setLoading(false)
      return
    }
    const data = (await response.json()) as ListResponse<InventoryProductRow>
    setItems(data.items)
    setTotalRows(data.total)
    setLoading(false)
  }, [pagination.pageIndex, pagination.pageSize, search, sorting])

  React.useEffect(() => {
    void loadProducts()
  }, [loadProducts])

  React.useEffect(() => {
    const loadDependencies = async () => {
      const [categoryResponse, supplierResponse, taxResponse, settingsResponse] =
        await Promise.all([
          fetch("/api/inventory/categories?page=1&pageSize=100&sort=sortOrder&order=asc", {
            cache: "no-store",
          }),
          fetch("/api/inventory/suppliers?page=1&pageSize=100&sort=name&order=asc", {
            cache: "no-store",
          }),
          fetch("/api/settings/taxes?page=1&pageSize=100", { cache: "no-store" }),
          fetch("/api/settings", { cache: "no-store" }),
        ])

      if (categoryResponse.ok) {
        const data = (await categoryResponse.json()) as ListResponse<InventoryCategoryOption>
        setCategories(data.items)
      }
      if (supplierResponse.ok) {
        const data = (await supplierResponse.json()) as ListResponse<SupplierOption>
        setSuppliers(data.items)
      }
      if (taxResponse.ok) {
        const data = (await taxResponse.json()) as ListResponse<TaxRow>
        setTaxes(data.items)
      }
      if (settingsResponse.ok) {
        const data = (await settingsResponse.json()) as { settings?: AppSettingsPayload }
        if (data.settings?.locale && data.settings.currency) {
          setSettings({
            locale: data.settings.locale,
            currency: data.settings.currency,
            currencySymbolPlacement: data.settings.currencySymbolPlacement ?? "BEFORE",
            numberFormat: data.settings.numberFormat ?? "US_UK",
          })
        }
      }
    }
    void loadDependencies()
  }, [])

  const resetForm = () => {
    setEditing(null)
    setFormValues(defaultInventoryProductFormValues)
    clearErrors()
  }

  const openCreate = () => {
    resetForm()
    setFormOpen(true)
  }

  const openEdit = React.useCallback((item: InventoryProductRow) => {
    setEditing(item)
    clearErrors()
    setFormValues({
      sku: item.sku,
      name: item.name,
      description: item.description ?? "",
      unit: item.unit,
      categoryId: item.category.id,
      status: item.status,
      costPrice: (item.costPriceCents / 100).toFixed(2),
      mrp: (item.mrpCents / 100).toFixed(2),
      reorderPoint: item.reorderPoint,
      reorderQty: item.reorderQty,
      onHandQty: item.onHandQty,
      isPhysical: item.isPhysical,
      taxIds: item.taxIds ?? [],
      supplierLinks: item.supplierLinks.map((link) => ({
        supplierId: link.supplierId,
        supplierSku: link.supplierSku ?? "",
        supplierCost:
          typeof link.supplierCostCents === "number"
            ? (link.supplierCostCents / 100).toFixed(2)
            : "",
        minOrderQty: link.minOrderQty,
        leadTimeDays: link.leadTimeDays ?? 0,
        isPreferred: link.isPreferred,
      })),
    })
    setFormOpen(true)
  }, [clearErrors])

  const save = async () => {
    setSaving(true)
    clearErrors()
    const payload = {
      sku: formValues.sku,
      name: formValues.name,
      description: formValues.description,
      unit: formValues.unit,
      categoryId: formValues.categoryId,
      status: formValues.status,
      costPriceCents: parseMoney(formValues.costPrice),
      mrpCents: parseMoney(formValues.mrp),
      reorderPoint: formValues.reorderPoint,
      reorderQty: formValues.reorderQty,
      onHandQty: formValues.onHandQty,
      isPhysical: formValues.isPhysical,
      taxIds: formValues.taxIds,
      supplierLinks: formValues.supplierLinks
        .filter((link) => link.supplierId)
        .map((link) => ({
          supplierId: link.supplierId,
          supplierSku: link.supplierSku,
          supplierCostCents: link.supplierCost ? parseMoney(link.supplierCost) : undefined,
          minOrderQty: link.minOrderQty,
          leadTimeDays: link.leadTimeDays,
          isPreferred: link.isPreferred,
        })),
    }

    const response = await fetch(
      editing ? `/api/inventory/products/${editing.id}` : "/api/inventory/products",
      {
        method: editing ? "PATCH" : "POST",
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
      toast.error(data.error ?? "Unable to save product.")
      setSaving(false)
      return
    }

    toast.success(editing ? "Product updated." : "Product created.")
    setSaving(false)
    setFormOpen(false)
    resetForm()
    await loadProducts()
  }

  const removeProduct = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    const response = await fetch(`/api/inventory/products/${deleteTarget.id}`, {
      method: "DELETE",
    })
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string }
      toast.error(data.error ?? "Unable to delete product.")
      setDeleting(false)
      return
    }
    toast.success("Product deleted.")
    setDeleting(false)
    setDeleteOpen(false)
    setDeleteTarget(null)
    await loadProducts()
  }

  const columns = React.useMemo<ColumnDef<InventoryProductRow>[]>(
    () => [
      {
        accessorKey: "sku",
        meta: { label: "SKU" },
        header: ({ column }) => (
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm font-medium"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            SKU
            <SortIndicator value={column.getIsSorted()} />
          </button>
        ),
      },
      {
        id: "name",
        accessorFn: (row) => row.name,
        meta: { label: "Product" },
        header: ({ column }) => (
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm font-medium"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Product
            <SortIndicator value={column.getIsSorted()} />
          </button>
        ),
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.original.name}</span>
            <span className="text-xs text-muted-foreground">{row.original.category.name}</span>
          </div>
        ),
      },
      {
        accessorKey: "costPriceCents",
        meta: { label: "CP" },
        header: "CP",
        cell: ({ row }) => formatMoney(row.original.costPriceCents),
      },
      {
        accessorKey: "mrpCents",
        meta: { label: "MRP" },
        header: "MRP",
        cell: ({ row }) => formatMoney(row.original.mrpCents),
      },
      {
        accessorKey: "onHandQty",
        meta: { label: "On hand" },
        header: "On hand",
      },
      {
        id: "reorder",
        meta: { label: "Reorder" },
        header: "Reorder",
        cell: ({ row }) => `${row.original.reorderPoint}/${row.original.reorderQty}`,
      },
      {
        id: "supplierCount",
        meta: { label: "Suppliers" },
        header: "Suppliers",
        cell: ({ row }) => row.original.supplierLinks.length,
      },
      {
        accessorKey: "status",
        meta: { label: "Status" },
        header: "Status",
        cell: ({ row }) => (row.original.status === "ACTIVE" ? "Active" : "Inactive"),
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
              <DropdownMenuItem onSelect={() => openEdit(row.original)}>
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onSelect={() => {
                  setDeleteTarget(row.original)
                  setDeleteOpen(true)
                }}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [formatMoney, openEdit]
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Inventory products</h1>
          <p className="text-sm text-muted-foreground">
            Track products, supplier mapping, taxes, and stock levels.
          </p>
        </div>
        <Button onClick={openCreate}>New product</Button>
      </div>

      <DataTableToolbar table={table} searchPlaceholder="Search products by name/SKU" />
      <DataTable table={table} loading={loading} emptyMessage="No products found." />
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
            <DialogTitle>Delete product</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `Delete "${deleteTarget.name}"? Linked records will force inactive status instead.`
                : "Delete this product?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={removeProduct} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) resetForm()
        }}
      >
        <DialogContent className="max-h-[90vh] flex flex-col max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit product" : "New product"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Update product, supplier links, and tax defaults."
                : "Create a physical product with suppliers and taxes."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-1">
            <ProductFormFields
              values={formValues}
              errors={errors}
              categories={categories}
              suppliers={suppliers}
              taxes={taxes}
              onChange={setFormValues}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving..." : editing ? "Save changes" : "Create product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
