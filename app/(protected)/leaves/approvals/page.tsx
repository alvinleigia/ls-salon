"use client"

import * as React from "react"
import {
  ColumnDef,
  SortingState,
  VisibilityState,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon, MoreHorizontalIcon } from "lucide-react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { DataTable, DataTablePagination, DataTableToolbar } from "@/components/data-table"
import { FormField } from "@/components/form-field"
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
import { Input } from "@/components/ui/input"
import type { ListResponse } from "@/types/api"
import type { LeaveRequestRow, LeaveRequestStatus } from "@/types/leaves"

type PaginationState = { pageIndex: number; pageSize: number }

const sortFieldMap: Record<string, "startDate" | "endDate" | "status" | "daysCount" | "createdAt" | "updatedAt"> =
  {
    startDate: "startDate",
    endDate: "endDate",
    status: "status",
    daysCount: "daysCount",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
  }

const statusOptions: Array<LeaveRequestStatus | "all"> = [
  "all",
  "PENDING",
  "APPROVED",
  "REJECTED",
  "CANCELED",
]

const SortIndicator = ({ value }: { value: false | "asc" | "desc" }) => {
  if (value === "asc") return <ArrowUpIcon className="h-4 w-4" />
  if (value === "desc") return <ArrowDownIcon className="h-4 w-4" />
  return <ArrowUpDownIcon className="h-4 w-4" />
}

export default function LeaveApprovalsPage() {
  const { data: session } = useSession()
  const role = (session?.user as { role?: string })?.role
  const canManage = role === "ADMIN" || role === "MANAGER"
  const router = useRouter()

  const [loading, setLoading] = React.useState(true)
  const [rows, setRows] = React.useState<LeaveRequestRow[]>([])
  const [totalRows, setTotalRows] = React.useState(0)
  const [search, setSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<LeaveRequestStatus | "all">("PENDING")
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "createdAt", desc: true }])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({
    staff: true,
    leave: true,
    range: true,
    days: true,
    status: true,
    reason: true,
    createdAt: true,
  })
  const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize: 10 })
  const [processing, setProcessing] = React.useState(false)
  const [rejectOpen, setRejectOpen] = React.useState(false)
  const [rejectComment, setRejectComment] = React.useState("")
  const [rejectTarget, setRejectTarget] = React.useState<LeaveRequestRow | null>(null)

  React.useEffect(() => {
    if (role && !canManage) {
      router.replace("/leaves/requests")
    }
  }, [canManage, role, router])

  const loadRows = React.useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set("page", String(pagination.pageIndex + 1))
    params.set("pageSize", String(pagination.pageSize))
    if (search.trim()) params.set("q", search.trim())
    if (statusFilter !== "all") params.set("status", statusFilter)
    const sortField = sorting[0] ? sortFieldMap[sorting[0].id] : undefined
    if (sortField && sorting[0]) {
      params.set("sort", sortField)
      params.set("order", sorting[0].desc ? "desc" : "asc")
    }

    const response = await fetch(`/api/leaves/requests?${params.toString()}`, { cache: "no-store" })
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string }
      toast.error(data.error ?? "Unable to load leave approval queue.")
      setRows([])
      setTotalRows(0)
      setLoading(false)
      return
    }
    const data = (await response.json()) as ListResponse<LeaveRequestRow>
    setRows(data.items)
    setTotalRows(data.total)
    setLoading(false)
  }, [pagination.pageIndex, pagination.pageSize, search, sorting, statusFilter])

  React.useEffect(() => {
    if (canManage) {
      void loadRows()
    }
  }, [canManage, loadRows])

  React.useEffect(() => {
    setPagination((prev) => (prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 }))
  }, [search, sorting, statusFilter])

  const reviewRequest = React.useCallback(
    async (item: LeaveRequestRow, status: "APPROVED" | "REJECTED", reviewerComment = "") => {
      setProcessing(true)
      const response = await fetch(`/api/leaves/requests/${item.id}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reviewerComment }),
      })
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string }
        toast.error(data.error ?? "Unable to review leave request.")
        setProcessing(false)
        return
      }
      toast.success(status === "APPROVED" ? "Leave request approved." : "Leave request rejected.")
      setProcessing(false)
      await loadRows()
    },
    [loadRows]
  )

  const openReject = React.useCallback((item: LeaveRequestRow) => {
    setRejectTarget(item)
    setRejectComment("")
    setRejectOpen(true)
  }, [])

  const confirmReject = React.useCallback(async () => {
    if (!rejectTarget) return
    if (!rejectComment.trim()) {
      toast.error("Comment is required to reject a leave request.")
      return
    }
    await reviewRequest(rejectTarget, "REJECTED", rejectComment)
    setRejectOpen(false)
    setRejectTarget(null)
    setRejectComment("")
  }, [rejectComment, rejectTarget, reviewRequest])

  const columns = React.useMemo<ColumnDef<LeaveRequestRow>[]>(
    () => [
      {
        id: "staff",
        meta: { label: "Staff" },
        header: "Staff",
        cell: ({ row }) => row.original.staff.name || row.original.staff.email,
      },
      {
        id: "leave",
        meta: { label: "Leave type" },
        header: "Leave type",
        cell: ({ row }) => `${row.original.leaveDefinition.code} - ${row.original.leaveDefinition.name}`,
      },
      {
        id: "range",
        meta: { label: "Date range" },
        header: ({ column }) => (
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm font-medium"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Date range
            <SortIndicator value={column.getIsSorted()} />
          </button>
        ),
        accessorFn: (row) => row.startDate,
        cell: ({ row }) =>
          `${new Date(row.original.startDate).toLocaleDateString()} - ${new Date(row.original.endDate).toLocaleDateString()}`,
      },
      {
        accessorKey: "daysCount",
        meta: { label: "Days" },
        header: "Days",
      },
      {
        accessorKey: "status",
        meta: { label: "Status" },
        header: "Status",
      },
      {
        accessorKey: "reason",
        meta: { label: "Reason" },
        header: "Reason",
        cell: ({ row }) => row.original.reason || "-",
      },
      {
        accessorKey: "createdAt",
        meta: { label: "Requested" },
        header: ({ column }) => (
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm font-medium"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Requested
            <SortIndicator value={column.getIsSorted()} />
          </button>
        ),
        cell: ({ row }) => new Date(row.original.createdAt).toLocaleString(),
      },
      {
        id: "actions",
        header: "",
        enableHiding: false,
        cell: ({ row }) => {
          const canReview = row.original.status === "PENDING"
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" disabled={!canReview || processing}>
                  <MoreHorizontalIcon className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  disabled={!canReview || processing}
                  onSelect={() => void reviewRequest(row.original, "APPROVED")}
                >
                  Approve
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  disabled={!canReview || processing}
                  onSelect={() => openReject(row.original)}
                >
                  Reject
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
      },
    ],
    [openReject, processing, reviewRequest]
  )

  const totalPages = Math.max(1, Math.ceil(totalRows / pagination.pageSize))
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, columnVisibility, globalFilter: search, pagination },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setSearch,
    onPaginationChange: setPagination,
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    pageCount: totalPages,
    getCoreRowModel: getCoreRowModel(),
  })

  if (!canManage) {
    return null
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Leave Approvals</h1>
          <p className="text-sm text-muted-foreground">
            Review and process pending leave requests.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/leaves/requests">My requests</Link>
        </Button>
      </div>

      <DataTableToolbar table={table} searchPlaceholder="Search by staff, leave or reason">
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as LeaveRequestStatus | "all")}
        >
          {statusOptions.map((item) => (
            <option key={item} value={item}>
              {item === "all" ? "All statuses" : item}
            </option>
          ))}
        </select>
      </DataTableToolbar>

      <DataTable table={table} loading={loading} emptyMessage="No leave requests found." />
      <DataTablePagination table={table} totalRows={totalRows} />

      <Dialog
        open={rejectOpen}
        onOpenChange={(open) => {
          setRejectOpen(open)
          if (!open) {
            setRejectTarget(null)
            setRejectComment("")
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject leave request</DialogTitle>
            <DialogDescription>Add a reason for rejecting this request.</DialogDescription>
          </DialogHeader>
          <FormField id="reject-comment" label="Comment">
            <Input
              id="reject-comment"
              value={rejectComment}
              onChange={(event) => setRejectComment(event.target.value)}
              placeholder="Reason for rejection"
            />
          </FormField>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)} disabled={processing}>
              Back
            </Button>
            <Button variant="destructive" onClick={() => void confirmReject()} disabled={processing}>
              {processing ? "Rejecting..." : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
