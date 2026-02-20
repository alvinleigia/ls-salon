"use client"

import * as React from "react"
import {
  ColumnDef,
  SortingState,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table"
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  MoreHorizontalIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"

import { DataTable, DataTablePagination, DataTableToolbar } from "@/components/data-table"
import { FormField } from "@/components/form-field"
import { SearchableSelect } from "@/components/searchable-select"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { formatCurrencyFromCents } from "@/lib/formatting"
import type { ListResponse } from "@/types/api"
import type {
  InventoryProductRow,
  PurchaseOrderFormValues,
  PurchaseOrderRow,
  SupplierRow,
} from "@/types/inventory"
import type { AppSettingsPayload } from "@/types/scheduling"

const defaultValues: PurchaseOrderFormValues = {
  supplierId: "",
  orderDate: new Date().toISOString().slice(0, 10),
  expectedDate: "",
  status: "ORDERED",
  notes: "",
  items: [{ productId: "", quantity: 1, unitCost: "0.00" }],
}

type PaginationState = { pageIndex: number; pageSize: number }

const SortIndicator = ({ value }: { value: false | "asc" | "desc" }) => {
  if (value === "asc") return <ArrowUpIcon className="h-4 w-4" />
  if (value === "desc") return <ArrowDownIcon className="h-4 w-4" />
  return <ArrowUpDownIcon className="h-4 w-4" />
}

export default function InventoryPurchasesPage() {
  const [items, setItems] = React.useState<PurchaseOrderRow[]>([])
  const [suppliers, setSuppliers] = React.useState<SupplierRow[]>([])
  const [products, setProducts] = React.useState<InventoryProductRow[]>([])
  const [totalRows, setTotalRows] = React.useState(0)
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState("")
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize: 10 })
  const [formOpen, setFormOpen] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [formValues, setFormValues] = React.useState<PurchaseOrderFormValues>(defaultValues)
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
  const productOptions = React.useMemo(
    () =>
      products.map((product) => ({
        value: product.id,
        label: `${product.sku} - ${product.name}`,
      })),
    [products]
  )
  const supplierOptions = React.useMemo(
    () => suppliers.map((supplier) => ({ value: supplier.id, label: supplier.name })),
    [suppliers]
  )

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
    const response = await fetch(`/api/inventory/purchases?${params.toString()}`)
    if (!response.ok) {
      toast.error("Unable to load purchase orders.")
      setItems([])
      setTotalRows(0)
      setLoading(false)
      return
    }
    const data = (await response.json()) as ListResponse<PurchaseOrderRow>
    setItems(data.items)
    setTotalRows(data.total)
    setLoading(false)
  }, [pagination.pageIndex, pagination.pageSize, search, sorting])

  React.useEffect(() => {
    void loadItems()
  }, [loadItems])

  React.useEffect(() => {
    const loadDependencies = async () => {
      const [supplierResponse, productResponse, settingsResponse] = await Promise.all([
        fetch("/api/inventory/suppliers?page=1&pageSize=100&status=ACTIVE"),
        fetch("/api/inventory/products?page=1&pageSize=100&status=ACTIVE"),
        fetch("/api/settings", { cache: "no-store" }),
      ])
      if (supplierResponse.ok) {
        const data = (await supplierResponse.json()) as ListResponse<SupplierRow>
        setSuppliers(data.items)
      }
      if (productResponse.ok) {
        const data = (await productResponse.json()) as ListResponse<InventoryProductRow>
        setProducts(data.items)
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

  const save = async () => {
    setSaving(true)
    const payload = {
      ...formValues,
      items: formValues.items
        .filter((item) => item.productId)
        .map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitCostCents: parseMoney(item.unitCost),
        })),
    }
    const response = await fetch("/api/inventory/purchases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string }
      toast.error(data.error ?? "Unable to create purchase order.")
      setSaving(false)
      return
    }
    toast.success("Purchase order created.")
    setSaving(false)
    setFormOpen(false)
    setFormValues(defaultValues)
    await loadItems()
  }

  const markReceived = React.useCallback(async (order: PurchaseOrderRow) => {
    if (order.status === "RECEIVED") return
    const response = await fetch(`/api/inventory/purchases/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "RECEIVED" }),
    })
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string }
      toast.error(data.error ?? "Unable to mark as received.")
      return
    }
    toast.success("Purchase order received. Stock updated.")
    await loadItems()
  }, [loadItems])

  const columns = React.useMemo<ColumnDef<PurchaseOrderRow>[]>(
    () => [
      {
        accessorKey: "orderNumber",
        meta: { label: "PO number" },
        header: ({ column }) => (
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm font-medium"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            PO number
            <SortIndicator value={column.getIsSorted()} />
          </button>
        ),
      },
      {
        id: "supplier",
        accessorFn: (row) => row.supplier.name,
        meta: { label: "Supplier" },
        header: "Supplier",
      },
      { accessorKey: "orderDate", meta: { label: "Order date" }, header: "Order date" },
      { accessorKey: "status", meta: { label: "Status" }, header: "Status" },
      {
        accessorKey: "totalCents",
        meta: { label: "Total" },
        header: "Total",
        cell: ({ row }) => formatMoney(row.original.totalCents),
      },
      {
        id: "actions",
        meta: { label: "Actions" },
        header: "",
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost">
                <MoreHorizontalIcon className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                disabled={row.original.status === "RECEIVED"}
                onSelect={() => void markReceived(row.original)}
              >
                Mark as received
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [formatMoney, markReceived]
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
          <h1 className="text-2xl font-semibold">Purchase orders</h1>
          <p className="text-sm text-muted-foreground">
            Create supplier purchases and receive stock into inventory.
          </p>
        </div>
        <Button
          onClick={() => {
            setFormValues(defaultValues)
            setFormOpen(true)
          }}
        >
          <PlusIcon className="mr-2 h-4 w-4" />
          New PO
        </Button>
      </div>

      <DataTableToolbar table={table} searchPlaceholder="Search by PO number or supplier" />
      <DataTable table={table} loading={loading} emptyMessage="No purchase orders found." />
      <DataTablePagination table={table} totalRows={totalRows} />

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) setFormValues(defaultValues)
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>New purchase order</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 px-1">
            <div className="grid gap-3 md:grid-cols-4">
              <FormField id="po-supplier" label="Supplier">
                <SearchableSelect
                  id="po-supplier"
                  value={formValues.supplierId}
                  placeholder="Select supplier"
                  searchPlaceholder="Search supplier..."
                  options={supplierOptions}
                  onChange={(nextValue) =>
                    setFormValues((prev) => ({ ...prev, supplierId: nextValue }))
                  }
                />
              </FormField>
              <FormField id="po-order-date" label="Order date">
                <Input
                  id="po-order-date"
                  type="date"
                  value={formValues.orderDate}
                  onChange={(event) =>
                    setFormValues((prev) => ({ ...prev, orderDate: event.target.value }))
                  }
                />
              </FormField>
              <FormField id="po-expected-date" label="Expected date">
                <Input
                  id="po-expected-date"
                  type="date"
                  value={formValues.expectedDate}
                  onChange={(event) =>
                    setFormValues((prev) => ({ ...prev, expectedDate: event.target.value }))
                  }
                />
              </FormField>
              <FormField id="po-status" label="Status">
                <select
                  id="po-status"
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={formValues.status}
                  onChange={(event) =>
                    setFormValues((prev) => ({
                      ...prev,
                      status: event.target.value as PurchaseOrderFormValues["status"],
                    }))
                  }
                >
                  <option value="ORDERED">Ordered</option>
                  <option value="DRAFT">Draft</option>
                  <option value="RECEIVED">Received</option>
                </select>
              </FormField>
            </div>

            <FormField id="po-notes" label="Notes">
              <Input
                id="po-notes"
                value={formValues.notes}
                onChange={(event) =>
                  setFormValues((prev) => ({ ...prev, notes: event.target.value }))
                }
              />
            </FormField>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Items</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setFormValues((prev) => ({
                      ...prev,
                      items: [...prev.items, { productId: "", quantity: 1, unitCost: "0.00" }],
                    }))
                  }
                >
                  Add item
                </Button>
              </div>
              {formValues.items.map((item, index) => (
                <div key={index} className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto]">
                  <FormField id={`po-item-product-${index}`} label="Product">
                    <SearchableSelect
                      id={`po-item-product-${index}`}
                      value={item.productId}
                      placeholder="Select product"
                      searchPlaceholder="Search by SKU or product name..."
                      emptyLabel="No products found."
                      options={productOptions}
                      onChange={(event) =>
                        setFormValues((prev) => ({
                          ...prev,
                          items: prev.items.map((row, rowIndex) =>
                            rowIndex === index ? { ...row, productId: event } : row
                          ),
                        }))
                      }
                    />
                  </FormField>
                  <FormField id={`po-item-qty-${index}`} label="Qty">
                    <Input
                      id={`po-item-qty-${index}`}
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(event) =>
                        setFormValues((prev) => ({
                          ...prev,
                          items: prev.items.map((row, rowIndex) =>
                            rowIndex === index
                              ? { ...row, quantity: Math.max(1, Number(event.target.value || 1)) }
                              : row
                          ),
                        }))
                      }
                    />
                  </FormField>
                  <FormField id={`po-item-cost-${index}`} label="Unit cost">
                    <Input
                      id={`po-item-cost-${index}`}
                      value={item.unitCost}
                      onChange={(event) =>
                        setFormValues((prev) => ({
                          ...prev,
                          items: prev.items.map((row, rowIndex) =>
                            rowIndex === index ? { ...row, unitCost: event.target.value } : row
                          ),
                        }))
                      }
                    />
                  </FormField>
                  <div className="pt-8">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      aria-label="Remove item"
                      onClick={() =>
                        setFormValues((prev) => ({
                          ...prev,
                          items: prev.items.filter((_, rowIndex) => rowIndex !== index),
                        }))
                      }
                      disabled={formValues.items.length === 1}
                    >
                      <Trash2Icon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} loading={saving} loadingText="Saving...">
              Create PO
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
