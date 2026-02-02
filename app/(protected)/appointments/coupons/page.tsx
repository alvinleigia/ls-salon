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
import type { CouponRow, DiscountType } from "@/types/appointments"

type CouponFormValues = {
  code: string
  name: string
  discountType: DiscountType
  discountValue: number
  isActive: boolean
  validFrom: string
  validTo: string
  maxUses: string
}

const defaultCouponFormValues: CouponFormValues = {
  code: "",
  name: "",
  discountType: "PERCENT",
  discountValue: 0,
  isActive: true,
  validFrom: "",
  validTo: "",
  maxUses: "",
}

type PaginationState = { pageIndex: number; pageSize: number }

const SortIndicator = ({ value }: { value: false | "asc" | "desc" }) => {
  if (value === "asc") return <ArrowUpIcon className="h-4 w-4" />
  if (value === "desc") return <ArrowDownIcon className="h-4 w-4" />
  return <ArrowUpDownIcon className="h-4 w-4" />
}

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
  const { errors, setErrorsFromResponse, clearErrors } = useFormErrors()

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
      isActive: coupon.isActive,
      validFrom: coupon.validFrom ?? "",
      validTo: coupon.validTo ?? "",
      maxUses: coupon.maxUses ? String(coupon.maxUses) : "",
    })
    clearErrors()
    setFormOpen(true)
  }

  const save = async () => {
    setSaving(true)
    clearErrors()
    const payload = {
      ...formValues,
      maxUses: formValues.maxUses ? Number(formValues.maxUses) : undefined,
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
    []
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit coupon" : "New coupon"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
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
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving..." : editing ? "Save changes" : "Create coupon"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
