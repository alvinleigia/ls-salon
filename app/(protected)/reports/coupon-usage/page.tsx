"use client"

import * as React from "react"
import {
  ColumnDef,
  PaginationState,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { DataTable, DataTablePagination, DataTableToolbar } from "@/components/data-table"
import { FormField } from "@/components/form-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { ListResponse } from "@/types/api"
import type {
  CouponUsageReportRow,
  CouponUsageReportStatus,
  CouponUsageReportSummary,
} from "@/types/reports"

type CouponUsageResponse = ListResponse<CouponUsageReportRow> & {
  summary: CouponUsageReportSummary
  status: CouponUsageReportStatus
}

const defaultSummary: CouponUsageReportSummary = {
  totalCustomers: 0,
  usedCustomers: 0,
  notUsedCustomers: 0,
  totalRedemptions: 0,
}

const formatDateTime = (value: string | null) => {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleString()
}

export default function CouponUsageReportPage() {
  const [items, setItems] = React.useState<CouponUsageReportRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState("")
  const [status, setStatus] = React.useState<CouponUsageReportStatus>("used")
  const [couponCode, setCouponCode] = React.useState("")
  const [dateFrom, setDateFrom] = React.useState("")
  const [dateTo, setDateTo] = React.useState("")
  const [summary, setSummary] = React.useState<CouponUsageReportSummary>(defaultSummary)
  const [totalRows, setTotalRows] = React.useState(0)
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })

  const loadReport = React.useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set("page", String(pagination.pageIndex + 1))
    params.set("pageSize", String(pagination.pageSize))
    params.set("status", status)
    if (search.trim()) params.set("q", search.trim())
    if (couponCode.trim()) params.set("couponCode", couponCode.trim().toUpperCase())
    if (dateFrom) params.set("dateFrom", dateFrom)
    if (dateTo) params.set("dateTo", dateTo)

    const response = await fetch(`/api/reports/coupon-usage?${params.toString()}`, {
      cache: "no-store",
    })
    if (!response.ok) {
      setItems([])
      setTotalRows(0)
      setSummary(defaultSummary)
      setLoading(false)
      return
    }

    const data = (await response.json()) as CouponUsageResponse
    setItems(data.items)
    setTotalRows(data.total)
    setSummary(data.summary)
    setLoading(false)
  }, [couponCode, dateFrom, dateTo, pagination.pageIndex, pagination.pageSize, search, status])

  React.useEffect(() => {
    void loadReport()
  }, [loadReport])

  const columns = React.useMemo<ColumnDef<CouponUsageReportRow>[]>(
    () => [
      {
        id: "customer",
        header: "Customer",
        accessorFn: (row) => row.customerName || "Unnamed customer",
      },
      {
        id: "contact",
        header: "Contact",
        cell: ({ row }) => (
          <div className="space-y-1">
            <div>{row.original.customerEmail}</div>
            <div className="text-xs text-muted-foreground">{row.original.customerPhone || "-"}</div>
          </div>
        ),
      },
      {
        id: "usage",
        header: "Usage count",
        accessorFn: (row) => row.couponUsageCount,
      },
      {
        id: "distinct",
        header: "Distinct coupons",
        accessorFn: (row) => row.distinctCouponCount,
      },
      {
        id: "lastUsed",
        header: "Last used",
        accessorFn: (row) => formatDateTime(row.lastCouponUsedAt),
      },
      {
        id: "codes",
        header: "Coupon codes",
        cell: ({ row }) =>
          row.original.usedCouponCodes.length ? row.original.usedCouponCodes.join(", ") : "-",
      },
    ],
    []
  )

  const table = useReactTable({
    data: items,
    columns,
    state: { pagination, globalFilter: search },
    onPaginationChange: setPagination,
    onGlobalFilterChange: (value) => {
      setSearch(String(value))
      setPagination((prev) => ({ ...prev, pageIndex: 0 }))
    },
    getCoreRowModel: getCoreRowModel(),
    manualFiltering: true,
    manualPagination: true,
    pageCount: Math.max(1, Math.ceil(totalRows / pagination.pageSize)),
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Coupon usage report</h1>
        <p className="text-sm text-muted-foreground">
          Track which customers used coupons and who has never used one.
        </p>
      </div>

      <div className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="text-xs uppercase text-muted-foreground">Total customers</div>
          <div className="text-2xl font-semibold">{summary.totalCustomers}</div>
        </div>
        <div>
          <div className="text-xs uppercase text-muted-foreground">Used coupons</div>
          <div className="text-2xl font-semibold">{summary.usedCustomers}</div>
        </div>
        <div>
          <div className="text-xs uppercase text-muted-foreground">Not used coupons</div>
          <div className="text-2xl font-semibold">{summary.notUsedCustomers}</div>
        </div>
        <div>
          <div className="text-xs uppercase text-muted-foreground">Total redemptions</div>
          <div className="text-2xl font-semibold">{summary.totalRedemptions}</div>
        </div>
      </div>

      <DataTableToolbar table={table} searchPlaceholder="Search customer name, email, or phone">
        <div className="flex flex-wrap items-end gap-2">
          <FormField id="report-status" label="Status">
            <select
              id="report-status"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as CouponUsageReportStatus)
                setPagination((prev) => ({ ...prev, pageIndex: 0 }))
              }}
            >
              <option value="used">Used coupons</option>
              <option value="not_used">Not used coupons</option>
            </select>
          </FormField>
          <FormField id="report-coupon-code" label="Coupon code">
            <Input
              id="report-coupon-code"
              value={couponCode}
              onChange={(event) => {
                setCouponCode(event.target.value.toUpperCase())
                setPagination((prev) => ({ ...prev, pageIndex: 0 }))
              }}
              placeholder="Any code"
              className="w-36"
            />
          </FormField>
          <FormField id="report-date-from" label="Date from">
            <Input
              id="report-date-from"
              type="date"
              value={dateFrom}
              onChange={(event) => {
                setDateFrom(event.target.value)
                setPagination((prev) => ({ ...prev, pageIndex: 0 }))
              }}
            />
          </FormField>
          <FormField id="report-date-to" label="Date to">
            <Input
              id="report-date-to"
              type="date"
              value={dateTo}
              onChange={(event) => {
                setDateTo(event.target.value)
                setPagination((prev) => ({ ...prev, pageIndex: 0 }))
              }}
            />
          </FormField>
          <Button
            variant="outline"
            onClick={() => {
              setCouponCode("")
              setDateFrom("")
              setDateTo("")
              setSearch("")
              setStatus("used")
              setPagination({ pageIndex: 0, pageSize: 10 })
            }}
          >
            Reset
          </Button>
        </div>
      </DataTableToolbar>

      <DataTable
        table={table}
        loading={loading}
        emptyMessage={status === "used" ? "No coupon usage found." : "All customers have used coupons."}
      />
      <DataTablePagination table={table} totalRows={totalRows} />
    </div>
  )
}

