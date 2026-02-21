"use client"

import * as React from "react"
import {
  ColumnDef,
  PaginationState,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { toast } from "sonner"

import { DataTable, DataTablePagination, DataTableToolbar } from "@/components/data-table"
import { FormField } from "@/components/form-field"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import type { ListResponse } from "@/types/api"
import type { AuditLogReportRow } from "@/types/reports"

const formatDateTime = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleString()
}

const prettyJson = (value: unknown) => {
  if (value === null || value === undefined) return "-"
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

export default function AuditLogsReportPage() {
  const [items, setItems] = React.useState<AuditLogReportRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState("")
  const [event, setEvent] = React.useState("")
  const [entityType, setEntityType] = React.useState("")
  const [requestId, setRequestId] = React.useState("")
  const [dateFrom, setDateFrom] = React.useState("")
  const [dateTo, setDateTo] = React.useState("")
  const [totalRows, setTotalRows] = React.useState(0)
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })
  const [detail, setDetail] = React.useState<AuditLogReportRow | null>(null)

  const loadReport = React.useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set("page", String(pagination.pageIndex + 1))
    params.set("pageSize", String(pagination.pageSize))
    if (search.trim()) params.set("q", search.trim())
    if (event.trim()) params.set("event", event.trim())
    if (entityType.trim()) params.set("entityType", entityType.trim())
    if (requestId.trim()) params.set("requestId", requestId.trim())
    if (dateFrom) params.set("dateFrom", dateFrom)
    if (dateTo) params.set("dateTo", dateTo)

    const response = await fetch(`/api/reports/audit-logs?${params.toString()}`, {
      cache: "no-store",
    })
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string }
      toast.error(data.error ?? "Unable to load audit logs.")
      setItems([])
      setTotalRows(0)
      setLoading(false)
      return
    }

    const data = (await response.json()) as ListResponse<AuditLogReportRow>
    setItems(data.items)
    setTotalRows(data.total)
    setLoading(false)
  }, [dateFrom, dateTo, entityType, event, pagination.pageIndex, pagination.pageSize, requestId, search])

  React.useEffect(() => {
    void loadReport()
  }, [loadReport])

  const columns = React.useMemo<ColumnDef<AuditLogReportRow>[]>(
    () => [
      {
        id: "createdAt",
        header: "When",
        accessorFn: (row) => formatDateTime(row.createdAt),
      },
      {
        accessorKey: "event",
        header: "Event",
      },
      {
        id: "entity",
        header: "Entity",
        cell: ({ row }) => (
          <div className="space-y-1">
            <div>{row.original.entityType}</div>
            <div className="text-xs text-muted-foreground">{row.original.entityId ?? "-"}</div>
          </div>
        ),
      },
      {
        id: "actor",
        header: "Actor",
        cell: ({ row }) => (
          <div className="space-y-1">
            <div>{row.original.actorName || "-"}</div>
            <div className="text-xs text-muted-foreground">
              {row.original.actorEmail || row.original.actorUserId || "-"}
            </div>
          </div>
        ),
      },
      {
        id: "requestId",
        header: "Request ID",
        accessorFn: (row) => row.requestId ?? "-",
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Button variant="outline" size="sm" onClick={() => setDetail(row.original)}>
            View
          </Button>
        ),
      },
    ],
    []
  )

  // eslint-disable-next-line react-hooks/incompatible-library
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
        <h1 className="text-2xl font-semibold">Audit logs</h1>
        <p className="text-sm text-muted-foreground">
          Review business events and actor changes with request correlation.
        </p>
      </div>

      <DataTableToolbar table={table} searchPlaceholder="Search event, entity, actor, or request ID">
        <div className="flex flex-wrap items-end gap-2">
          <FormField id="audit-event" label="Event">
            <Input
              id="audit-event"
              value={event}
              onChange={(eventValue) => {
                setEvent(eventValue.target.value)
                setPagination((prev) => ({ ...prev, pageIndex: 0 }))
              }}
              placeholder="leave.request.reviewed"
              className="w-52"
            />
          </FormField>
          <FormField id="audit-entity" label="Entity type">
            <Input
              id="audit-entity"
              value={entityType}
              onChange={(eventValue) => {
                setEntityType(eventValue.target.value)
                setPagination((prev) => ({ ...prev, pageIndex: 0 }))
              }}
              placeholder="LeaveRequest"
              className="w-40"
            />
          </FormField>
          <FormField id="audit-request-id" label="Request ID">
            <Input
              id="audit-request-id"
              value={requestId}
              onChange={(eventValue) => {
                setRequestId(eventValue.target.value)
                setPagination((prev) => ({ ...prev, pageIndex: 0 }))
              }}
              placeholder="request-id"
              className="w-48"
            />
          </FormField>
          <FormField id="audit-date-from" label="Date from">
            <Input
              id="audit-date-from"
              type="date"
              value={dateFrom}
              onChange={(eventValue) => {
                setDateFrom(eventValue.target.value)
                setPagination((prev) => ({ ...prev, pageIndex: 0 }))
              }}
            />
          </FormField>
          <FormField id="audit-date-to" label="Date to">
            <Input
              id="audit-date-to"
              type="date"
              value={dateTo}
              onChange={(eventValue) => {
                setDateTo(eventValue.target.value)
                setPagination((prev) => ({ ...prev, pageIndex: 0 }))
              }}
            />
          </FormField>
          <Button
            variant="outline"
            onClick={() => {
              setEvent("")
              setEntityType("")
              setRequestId("")
              setDateFrom("")
              setDateTo("")
              setSearch("")
              setPagination({ pageIndex: 0, pageSize: 10 })
            }}
          >
            Reset
          </Button>
        </div>
      </DataTableToolbar>

      <DataTable table={table} loading={loading} emptyMessage="No audit logs found." />
      <DataTablePagination table={table} totalRows={totalRows} />

      <Dialog open={Boolean(detail)} onOpenChange={(open) => (!open ? setDetail(null) : null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{detail?.event || "Audit entry"}</DialogTitle>
            <DialogDescription>
              {detail ? `${formatDateTime(detail.createdAt)} | ${detail.entityType}` : ""}
            </DialogDescription>
          </DialogHeader>
          {detail ? (
            <div className="space-y-4 text-sm">
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <div className="font-medium">Actor</div>
                  <div>{detail.actorName || "-"}</div>
                  <div className="text-muted-foreground">{detail.actorEmail || detail.actorUserId || "-"}</div>
                </div>
                <div>
                  <div className="font-medium">Request ID</div>
                  <div className="break-all">{detail.requestId || "-"}</div>
                </div>
              </div>
              <div>
                <div className="font-medium">Metadata</div>
                <pre className="max-h-40 overflow-auto rounded-md border bg-muted p-3 text-xs">
                  {prettyJson(detail.metadata)}
                </pre>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="font-medium">Before</div>
                  <pre className="max-h-56 overflow-auto rounded-md border bg-muted p-3 text-xs">
                    {prettyJson(detail.before)}
                  </pre>
                </div>
                <div>
                  <div className="font-medium">After</div>
                  <pre className="max-h-56 overflow-auto rounded-md border bg-muted p-3 text-xs">
                    {prettyJson(detail.after)}
                  </pre>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
