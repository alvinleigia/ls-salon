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
import { SearchableMultiSelect } from "@/components/searchable-multi-select"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useFormErrors } from "@/hooks/use-form-errors"
import { formatCurrencyFromCents } from "@/lib/formatting"
import type { ListResponse } from "@/types/api"
import type {
  CouponAppliesTo,
  CouponRow,
  CouponStackingMode,
  DiscountType,
} from "@/types/appointments"
import type { AppSettingsPayload } from "@/types/scheduling"

type CouponFormValues = {
  code: string
  name: string
  discountType: DiscountType
  discountValue: number
  appliesTo: CouponAppliesTo
  allowedServiceIds: string[]
  allowedCategoryIds: string[]
  allowedProductIds: string[]
  minSubtotalCents: string
  stackingMode: CouponStackingMode
  isActive: boolean
  validFrom: string
  validTo: string
  maxUses: string
  maxUsesPerCustomer: string
}

const defaultCouponFormValues: CouponFormValues = {
  code: "",
  name: "",
  discountType: "PERCENT",
  discountValue: 0,
  appliesTo: "ORDER",
  allowedServiceIds: [],
  allowedCategoryIds: [],
  allowedProductIds: [],
  minSubtotalCents: "0",
  stackingMode: "STACKABLE",
  isActive: true,
  validFrom: "",
  validTo: "",
  maxUses: "",
  maxUsesPerCustomer: "",
}

type PaginationState = { pageIndex: number; pageSize: number }
type SelectOption = { value: string; label: string }
type ServiceListItem = { id: string; name: string }
type ServiceCategoryListItem = { id: string; name: string }
type ProductListItem = { id: string; name: string; sku: string }

const SortIndicator = ({ value }: { value: false | "asc" | "desc" }) => {
  if (value === "asc") return <ArrowUpIcon className="h-4 w-4" />
  if (value === "desc") return <ArrowDownIcon className="h-4 w-4" />
  return <ArrowUpDownIcon className="h-4 w-4" />
}

const formatAppliesTo = (value: CouponAppliesTo) => {
  if (value === "SERVICE_LINES") return "Service lines"
  if (value === "PRODUCT_LINES") return "Product lines"
  return "Order total"
}

const formatStackingMode = (value: CouponStackingMode) =>
  value === "EXCLUSIVE" ? "Exclusive" : "Stackable"

export default function AppointmentCouponsPage() {
  const [items, setItems] = React.useState<CouponRow[]>([])
  const [totalRows, setTotalRows] = React.useState(0)
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize: 10 })
  const [formOpen, setFormOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<CouponRow | null>(null)
  const [formValues, setFormValues] = React.useState<CouponFormValues>(defaultCouponFormValues)
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
  const [serviceOptions, setServiceOptions] = React.useState<SelectOption[]>([])
  const [serviceCategoryOptions, setServiceCategoryOptions] = React.useState<SelectOption[]>([])
  const [productOptions, setProductOptions] = React.useState<SelectOption[]>([])
  const [scopeOptionsLoading, setScopeOptionsLoading] = React.useState(false)
  const { errors, setErrorsFromResponse, clearErrors } = useFormErrors()
  const formatMoney = React.useCallback(
    (cents: number) => formatCurrencyFromCents(cents, settings),
    [settings]
  )

  const loadCoupons = React.useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set("page", String(pagination.pageIndex + 1))
    params.set("pageSize", String(pagination.pageSize))
    if (search.trim()) params.set("q", search.trim())

    const response = await fetch(`/api/appointments/coupons?${params.toString()}`, {
      cache: "no-store",
    })
    if (!response.ok) {
      toast.error("Unable to load coupons.")
      setItems([])
      setTotalRows(0)
      setLoading(false)
      return
    }
    const data = (await response.json()) as ListResponse<CouponRow>
    setItems(data.items)
    setTotalRows(data.total)
    setLoading(false)
  }, [pagination.pageIndex, pagination.pageSize, search])

  React.useEffect(() => {
    void loadCoupons()
  }, [loadCoupons])

  const loadScopeOptions = React.useCallback(async () => {
    setScopeOptionsLoading(true)
    try {
      const [servicesResponse, categoriesResponse, productsResponse] = await Promise.all([
        fetch("/api/services?page=1&pageSize=100&status=ACTIVE&sort=name&order=asc", {
          cache: "no-store",
        }),
        fetch("/api/service-categories?page=1&pageSize=100&status=ACTIVE&sort=name&order=asc", {
          cache: "no-store",
        }),
        fetch("/api/inventory/products?page=1&pageSize=100&status=ACTIVE&sort=name&order=asc", {
          cache: "no-store",
        }),
      ])

      if (!servicesResponse.ok || !categoriesResponse.ok || !productsResponse.ok) {
        toast.error("Unable to load coupon scope options.")
        return
      }

      const servicesData = (await servicesResponse.json()) as ListResponse<ServiceListItem>
      const categoriesData = (await categoriesResponse.json()) as ListResponse<ServiceCategoryListItem>
      const productsData = (await productsResponse.json()) as ListResponse<ProductListItem>

      setServiceOptions(
        servicesData.items.map((service) => ({
          value: service.id,
          label: service.name,
        }))
      )
      setServiceCategoryOptions(
        categoriesData.items.map((category) => ({
          value: category.id,
          label: category.name,
        }))
      )
      setProductOptions(
        productsData.items.map((product) => ({
          value: product.id,
          label: `${product.name} (${product.sku})`,
        }))
      )
    } finally {
      setScopeOptionsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void loadScopeOptions()
  }, [loadScopeOptions])

  React.useEffect(() => {
    const loadSettings = async () => {
      const response = await fetch("/api/settings", { cache: "no-store" })
      if (!response.ok) return
      const data = (await response.json()) as { settings?: AppSettingsPayload }
      if (data.settings?.locale && data.settings.currency) {
        setSettings({
          locale: data.settings.locale,
          currency: data.settings.currency,
          currencySymbolPlacement: data.settings.currencySymbolPlacement ?? "BEFORE",
          numberFormat: data.settings.numberFormat ?? "US_UK",
        })
      }
    }
    void loadSettings()
  }, [])

  const openCreate = () => {
    setEditing(null)
    setFormValues(defaultCouponFormValues)
    clearErrors()
    setFormOpen(true)
  }

  const openEdit = (coupon: CouponRow) => {
    setEditing(coupon)
    setFormValues({
      code: coupon.code,
      name: coupon.name ?? "",
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      appliesTo: coupon.appliesTo,
      allowedServiceIds: coupon.allowedServiceIds,
      allowedCategoryIds: coupon.allowedCategoryIds,
      allowedProductIds: coupon.allowedProductIds,
      minSubtotalCents: String(coupon.minSubtotalCents),
      stackingMode: coupon.stackingMode,
      isActive: coupon.isActive,
      validFrom: coupon.validFrom ?? "",
      validTo: coupon.validTo ?? "",
      maxUses: coupon.maxUses ? String(coupon.maxUses) : "",
      maxUsesPerCustomer: coupon.maxUsesPerCustomer ? String(coupon.maxUsesPerCustomer) : "",
    })
    clearErrors()
    setFormOpen(true)
  }

  const save = async () => {
    setSaving(true)
    clearErrors()
    const payload = {
      ...formValues,
      minSubtotalCents: Number(formValues.minSubtotalCents || 0),
      maxUses: formValues.maxUses ? Number(formValues.maxUses) : undefined,
      maxUsesPerCustomer: formValues.maxUsesPerCustomer
        ? Number(formValues.maxUsesPerCustomer)
        : undefined,
    }
    const response = await fetch(
      editing ? `/api/appointments/coupons/${editing.id}` : "/api/appointments/coupons",
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
      toast.error(data.error ?? "Unable to save coupon.")
      setSaving(false)
      return
    }
    toast.success(editing ? "Coupon updated." : "Coupon created.")
    setSaving(false)
    setFormOpen(false)
    await loadCoupons()
  }

  const removeCoupon = async (coupon: CouponRow) => {
    const response = await fetch(`/api/appointments/coupons/${coupon.id}`, { method: "DELETE" })
    if (!response.ok) {
      toast.error("Unable to delete coupon.")
      return
    }
    toast.success("Coupon deleted.")
    await loadCoupons()
  }

  const columns = React.useMemo<ColumnDef<CouponRow>[]>(
    () => [
      {
        id: "code",
        meta: { label: "Code" },
        header: ({ column }) => (
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm font-medium"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Code
            <SortIndicator value={column.getIsSorted()} />
          </button>
        ),
        accessorFn: (row) => row.code,
      },
      {
        id: "discountType",
        meta: { label: "Type" },
        header: "Type",
        accessorFn: (row) => row.discountType,
      },
      {
        id: "discountValue",
        meta: { label: "Value" },
        header: "Value",
        accessorFn: (row) => row.discountValue,
      },
      {
        id: "appliesTo",
        meta: { label: "Applies to" },
        header: "Applies to",
        accessorFn: (row) => formatAppliesTo(row.appliesTo),
      },
      {
        id: "scope",
        meta: { label: "Scope" },
        header: "Scope",
        accessorFn: (row) => {
          const parts: string[] = []
          if (row.allowedServiceIds.length) {
            parts.push(`${row.allowedServiceIds.length} svc`)
          }
          if (row.allowedCategoryIds.length) {
            parts.push(`${row.allowedCategoryIds.length} cat`)
          }
          if (row.allowedProductIds.length) {
            parts.push(`${row.allowedProductIds.length} prod`)
          }
          return parts.length ? parts.join(" | ") : "All"
        },
      },
      {
        id: "stackingMode",
        meta: { label: "Stacking" },
        header: "Stacking",
        accessorFn: (row) => formatStackingMode(row.stackingMode),
      },
      {
        id: "minSubtotalCents",
        meta: { label: "Min subtotal" },
        header: "Min subtotal",
        cell: ({ row }) => formatMoney(row.original.minSubtotalCents),
      },
      {
        id: "status",
        meta: { label: "Status" },
        header: "Status",
        accessorFn: (row) => (row.isActive ? "Active" : "Inactive"),
      },
      {
        id: "actions",
        meta: { label: "Actions" },
        header: "",
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => openEdit(row.original)}>
              Edit
            </Button>
            <Button variant="outline" size="sm" onClick={() => void removeCoupon(row.original)}>
              Delete
            </Button>
          </div>
        ),
      },
    ],
    [formatMoney]
  )

  const table = useReactTable({
    data: items,
    columns,
    state: { sorting, pagination, globalFilter: search },
    onSortingChange: setSorting,
    onGlobalFilterChange: setSearch,
    onPaginationChange: (updater) => {
      setPagination((prev) =>
        typeof updater === "function" ? updater(prev as never) as PaginationState : updater
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
          <h1 className="text-2xl font-semibold">Appointment coupons</h1>
          <p className="text-sm text-muted-foreground">Create and manage reusable billing coupon codes.</p>
        </div>
        <Button onClick={openCreate}>
          <PlusIcon className="mr-2 h-4 w-4" />
          New coupon
        </Button>
      </div>

      <DataTableToolbar table={table} searchPlaceholder="Search coupons" />
      <DataTable table={table} loading={loading} emptyMessage="No coupons found." />
      <DataTablePagination table={table} totalRows={totalRows} />

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) {
            setEditing(null)
          }
        }}
      >
        <DialogContent className="max-h-[80vh] overflow-hidden sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit coupon" : "New coupon"}</DialogTitle>
          </DialogHeader>
          <div className="grid max-h-[60vh] gap-3 overflow-y-auto pr-1">
            <FormField id="coupon-code" label="Code" error={errors.code}>
              <Input
                id="coupon-code"
                value={formValues.code}
                onChange={(event) =>
                  setFormValues((prev) => ({ ...prev, code: event.target.value.toUpperCase() }))
                }
              />
            </FormField>
            <FormField id="coupon-name" label="Name" error={errors.name}>
              <Input
                id="coupon-name"
                value={formValues.name}
                onChange={(event) =>
                  setFormValues((prev) => ({ ...prev, name: event.target.value }))
                }
              />
            </FormField>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField id="coupon-type" label="Discount type" error={errors.discountType}>
                <select
                  id="coupon-type"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={formValues.discountType}
                  onChange={(event) =>
                    setFormValues((prev) => ({
                      ...prev,
                      discountType: event.target.value as DiscountType,
                    }))
                  }
                >
                  <option value="PERCENT">Percent</option>
                  <option value="AMOUNT">Amount</option>
                </select>
              </FormField>
              <FormField id="coupon-value" label="Discount value" error={errors.discountValue}>
                <Input
                  id="coupon-value"
                  type="number"
                  min={0}
                  step="0.01"
                  value={formValues.discountValue}
                  onChange={(event) =>
                    setFormValues((prev) => ({
                      ...prev,
                      discountValue: Math.max(0, Number(event.target.value || 0)),
                    }))
                  }
                />
              </FormField>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <FormField id="coupon-applies-to" label="Applies to" error={errors.appliesTo}>
                <select
                  id="coupon-applies-to"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={formValues.appliesTo}
                  onChange={(event) =>
                    setFormValues((prev) => ({
                      ...prev,
                      appliesTo: event.target.value as CouponAppliesTo,
                    }))
                  }
                >
                  <option value="ORDER">Order total</option>
                  <option value="SERVICE_LINES">Service lines</option>
                  <option value="PRODUCT_LINES">Product lines</option>
                </select>
              </FormField>
              <FormField id="coupon-stacking-mode" label="Stacking" error={errors.stackingMode}>
                <select
                  id="coupon-stacking-mode"
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={formValues.stackingMode}
                  onChange={(event) =>
                    setFormValues((prev) => ({
                      ...prev,
                      stackingMode: event.target.value as CouponStackingMode,
                    }))
                  }
                >
                  <option value="STACKABLE">Stackable</option>
                  <option value="EXCLUSIVE">Exclusive</option>
                </select>
              </FormField>
              <FormField
                id="coupon-min-subtotal"
                label="Min subtotal (cents)"
                error={errors.minSubtotalCents}
              >
                <Input
                  id="coupon-min-subtotal"
                  type="number"
                  min={0}
                  value={formValues.minSubtotalCents}
                  onChange={(event) =>
                    setFormValues((prev) => ({
                      ...prev,
                      minSubtotalCents: event.target.value,
                    }))
                  }
                />
              </FormField>
            </div>
            {formValues.appliesTo !== "PRODUCT_LINES" ? (
              <FormField
                id="coupon-allowed-services"
                label="Allowed services"
                error={errors.allowedServiceIds}
              >
                <SearchableMultiSelect
                  id="coupon-allowed-services"
                  values={formValues.allowedServiceIds}
                  onChange={(values) =>
                    setFormValues((prev) => ({
                      ...prev,
                      allowedServiceIds: values,
                    }))
                  }
                  options={serviceOptions}
                  disabled={scopeOptionsLoading}
                  placeholder={scopeOptionsLoading ? "Loading services..." : "All services"}
                  searchPlaceholder="Search services..."
                  emptyLabel="No services found."
                />
              </FormField>
            ) : null}
            <FormField
              id="coupon-allowed-categories"
              label="Allowed categories"
              error={errors.allowedCategoryIds}
            >
              <SearchableMultiSelect
                id="coupon-allowed-categories"
                values={formValues.allowedCategoryIds}
                onChange={(values) =>
                  setFormValues((prev) => ({
                    ...prev,
                    allowedCategoryIds: values,
                  }))
                }
                options={serviceCategoryOptions}
                disabled={scopeOptionsLoading}
                placeholder={scopeOptionsLoading ? "Loading categories..." : "All categories"}
                searchPlaceholder="Search categories..."
                emptyLabel="No categories found."
              />
            </FormField>
            {formValues.appliesTo !== "SERVICE_LINES" ? (
              <FormField
                id="coupon-allowed-products"
                label="Allowed products"
                error={errors.allowedProductIds}
              >
                <SearchableMultiSelect
                  id="coupon-allowed-products"
                  values={formValues.allowedProductIds}
                  onChange={(values) =>
                    setFormValues((prev) => ({
                      ...prev,
                      allowedProductIds: values,
                    }))
                  }
                  options={productOptions}
                  disabled={scopeOptionsLoading}
                  placeholder={scopeOptionsLoading ? "Loading products..." : "All products"}
                  searchPlaceholder="Search products..."
                  emptyLabel="No products found."
                />
              </FormField>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <FormField id="coupon-valid-from" label="Valid from" error={errors.validFrom}>
                <Input
                  id="coupon-valid-from"
                  type="date"
                  value={formValues.validFrom}
                  onChange={(event) =>
                    setFormValues((prev) => ({ ...prev, validFrom: event.target.value }))
                  }
                />
              </FormField>
              <FormField id="coupon-valid-to" label="Valid to" error={errors.validTo}>
                <Input
                  id="coupon-valid-to"
                  type="date"
                  value={formValues.validTo}
                  onChange={(event) =>
                    setFormValues((prev) => ({ ...prev, validTo: event.target.value }))
                  }
                />
              </FormField>
              <FormField id="coupon-max-uses" label="Max uses" error={errors.maxUses}>
                <Input
                  id="coupon-max-uses"
                  type="number"
                  min={1}
                  value={formValues.maxUses}
                  onChange={(event) =>
                    setFormValues((prev) => ({ ...prev, maxUses: event.target.value }))
                  }
                />
              </FormField>
              <FormField
                id="coupon-max-uses-per-customer"
                label="Per customer limit"
                error={errors.maxUsesPerCustomer}
              >
                <Input
                  id="coupon-max-uses-per-customer"
                  type="number"
                  min={1}
                  value={formValues.maxUsesPerCustomer}
                  onChange={(event) =>
                    setFormValues((prev) => ({
                      ...prev,
                      maxUsesPerCustomer: event.target.value,
                    }))
                  }
                />
              </FormField>
            </div>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formValues.isActive}
                onChange={(event) =>
                  setFormValues((prev) => ({ ...prev, isActive: event.target.checked }))
                }
              />
              Active
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} loading={saving} loadingText="Saving...">
              {editing ? "Save changes" : "Create coupon"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
