"use client"

import * as React from "react"
import Link from "next/link"
import {
  ColumnDef,
  SortingState,
  VisibilityState,
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
import type { ListResponse } from "@/types/api"
import type {
  LeaveDefinitionAllowedUsers,
  LeaveDefinitionRow,
  LeaveDefinitionStatus,
  LeaveDefinitionType,
} from "@/types/leaves"

type PaginationState = { pageIndex: number; pageSize: number }

const sortFieldMap: Record<string, "code" | "name" | "leaveType" | "allowedUsers" | "status" | "sortOrder" | "updatedAt"> = {
  code: "code",
  name: "name",
  leaveType: "leaveType",
  allowedUsers: "allowedUsers",
  status: "status",
  sortOrder: "sortOrder",
  updatedAt: "updatedAt",
}

const leaveTypeOptions: LeaveDefinitionType[] = [
  "PAID",
  "LAY_OFF",
  "UNPAID",
  "RESTRICTED",
  "COMPENSATORY",
  "TOUR_ON_DUTY",
]

const allowedUsersOptions: LeaveDefinitionAllowedUsers[] = ["ALL", "MALE", "FEMALE"]
const statusOptions: LeaveDefinitionStatus[] = ["ACTIVE", "INACTIVE"]

const SortIndicator = ({ value }: { value: false | "asc" | "desc" }) => {
  if (value === "asc") return <ArrowUpIcon className="h-4 w-4" />
  if (value === "desc") return <ArrowDownIcon className="h-4 w-4" />
  return <ArrowUpDownIcon className="h-4 w-4" />
}

export default function LeavesPage() {
  const [loading, setLoading] = React.useState(true)
  const [rows, setRows] = React.useState<LeaveDefinitionRow[]>([])
  const [totalRows, setTotalRows] = React.useState(0)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<LeaveDefinitionRow | null>(null)
  const [search, setSearch] = React.useState("")
  const [leaveTypeFilter, setLeaveTypeFilter] = React.useState<LeaveDefinitionType | "all">("all")
  const [allowedUsersFilter, setAllowedUsersFilter] = React.useState<LeaveDefinitionAllowedUsers | "all">("all")
  const [statusFilter, setStatusFilter] = React.useState<LeaveDefinitionStatus | "all">("all")
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "sortOrder", desc: false }])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({
    code: true,
    name: true,
    leaveType: true,
    allowedUsers: true,
    status: true,
    sortOrder: true,
    updatedAt: true,
  })
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })

  const loadRows = React.useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set("page", String(pagination.pageIndex + 1))
    params.set("pageSize", String(pagination.pageSize))
    if (search.trim()) params.set("q", search.trim())
    if (leaveTypeFilter !== "all") params.set("leaveType", leaveTypeFilter)
    if (allowedUsersFilter !== "all") params.set("allowedUsers", allowedUsersFilter)
    if (statusFilter !== "all") params.set("status", statusFilter)

    const sortField = sorting[0] ? sortFieldMap[sorting[0].id] : undefined
    if (sortField && sorting[0]) {
      params.set("sort", sortField)
      params.set("order", sorting[0].desc ? "desc" : "asc")
    }

    const response = await fetch(`/api/leaves/definitions?${params.toString()}`, {
      cache: "no-store",
    })
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string }
      toast.error(data.error ?? "Unable to load leave definitions.")
      setRows([])
      setTotalRows(0)
      setLoading(false)
      return
    }
    const data = (await response.json()) as ListResponse<LeaveDefinitionRow>
    setRows(data.items)
    setTotalRows(data.total)
    setLoading(false)
  }, [
    allowedUsersFilter,
    leaveTypeFilter,
    pagination.pageIndex,
    pagination.pageSize,
    search,
    sorting,
    statusFilter,
  ])

  React.useEffect(() => {
    void loadRows()
  }, [loadRows])

  React.useEffect(() => {
    setPagination((prev) => (prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 }))
  }, [allowedUsersFilter, leaveTypeFilter, search, sorting, statusFilter])

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

  const requestDelete = React.useCallback((row: LeaveDefinitionRow) => {
    setDeleteTarget(row)
    setDeleteOpen(true)
  }, [])

  const confirmDelete = React.useCallback(async () => {
    if (!deleteTarget) return
    setDeleting(true)
    const response = await fetch(`/api/leaves/definitions/${deleteTarget.id}`, {
      method: "DELETE",
    })
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string }
      toast.error(data.error ?? "Unable to delete leave definition.")
      setDeleting(false)
      return
    }
    toast.success("Leave definition deleted.")
    setDeleting(false)
    setDeleteOpen(false)
    setDeleteTarget(null)
    await loadRows()
  }, [deleteTarget, loadRows])

  const columns = React.useMemo<ColumnDef<LeaveDefinitionRow>[]>(
    () => [
      {
        accessorKey: "code",
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
      },
      {
        accessorKey: "name",
        meta: { label: "Name" },
        header: ({ column }) => (
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm font-medium"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Name
            <SortIndicator value={column.getIsSorted()} />
          </button>
        ),
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        accessorKey: "leaveType",
        meta: { label: "Leave type" },
        header: "Leave type",
      },
      {
        accessorKey: "allowedUsers",
        meta: { label: "Allowed users" },
        header: "Allowed users",
      },
      {
        accessorKey: "status",
        meta: { label: "Status" },
        header: "Status",
      },
      {
        accessorKey: "sortOrder",
        meta: { label: "Order" },
        header: "Order",
      },
      {
        accessorKey: "updatedAt",
        meta: { label: "Updated" },
        header: "Updated",
        cell: ({ row }) => new Date(row.original.updatedAt).toLocaleString(),
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
              <DropdownMenuItem asChild>
                <Link href={`/leaves/${row.original.id}`}>Edit</Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onSelect={() => requestDelete(row.original)}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [requestDelete]
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
          <h1 className="text-2xl font-semibold">Leave Definitions</h1>
          <p className="text-sm text-muted-foreground">
            Configure leave types and rules.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/leaves/groups">Leave groups</Link>
          </Button>
          <Button asChild>
            <Link href="/leaves/new">New leave definition</Link>
          </Button>
        </div>
      </div>

      <DataTableToolbar table={table} searchPlaceholder="Search by code or name">
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={leaveTypeFilter}
          onChange={(event) => setLeaveTypeFilter(event.target.value as LeaveDefinitionType | "all")}
        >
          <option value="all">All leave types</option>
          {leaveTypeOptions.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={allowedUsersFilter}
          onChange={(event) =>
            setAllowedUsersFilter(event.target.value as LeaveDefinitionAllowedUsers | "all")
          }
        >
          <option value="all">All users</option>
          {allowedUsersOptions.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as LeaveDefinitionStatus | "all")}
        >
          <option value="all">All status</option>
          {statusOptions.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </DataTableToolbar>

      <DataTable table={table} loading={loading} emptyMessage="No leave definitions found." />
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
            <DialogTitle>Delete leave definition</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `Delete "${deleteTarget.name}"? This cannot be undone.`
                : "Delete this leave definition? This cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
