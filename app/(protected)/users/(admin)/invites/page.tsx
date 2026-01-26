"use client"

import * as React from "react"
import {
  ColumnDef,
  SortingState,
  VisibilityState,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  DataTable,
  DataTablePagination,
  DataTableToolbar,
} from "@/components/data-table"
import { FormField } from "@/components/form-field"
import { useFormErrors } from "@/hooks/use-form-errors"
import type { Role } from "@/lib/permissions"
import type { ListResponse } from "@/types/api"


type InviteRow = {
  id: string
  email: string
  role: Role
  token: string
  createdAt: string
  expiresAt: string
  acceptedAt: string | null
}

const roleOptions: Role[] = ["ADMIN", "MANAGER", "STAFF", "CUSTOMER"]

const SortIndicator = ({ value }: { value: false | "asc" | "desc" }) => {
  if (value === "asc") return <ArrowUpIcon className="h-4 w-4" />
  if (value === "desc") return <ArrowDownIcon className="h-4 w-4" />
  return <ArrowUpDownIcon className="h-4 w-4" />
}

export default function InvitesPage() {
  type PaginationState = { pageIndex: number; pageSize: number }

  const [inviteOpen, setInviteOpen] = React.useState(false)
  const [invites, setInvites] = React.useState<InviteRow[]>([])
  const {
    errors: inviteErrors,
    setErrorsFromResponse: setInviteErrorsFromResponse,
    clearErrors: clearInviteErrors,
  } = useFormErrors()
  const [inviting, setInviting] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [totalRows, setTotalRows] = React.useState(0)

  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 10 })
  const [search, setSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<
    "all" | "pending" | "accepted" | "expired"
  >("pending")

  const [inviteValues, setInviteValues] = React.useState({
    email: "",
    role: "CUSTOMER" as Role,
  })

  const totalPages = Math.max(1, Math.ceil(totalRows / pagination.pageSize))

  const loadInvites = React.useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set("page", String(pagination.pageIndex + 1))
    params.set("pageSize", String(pagination.pageSize))
    if (search) {
      params.set("q", search)
    }
    if (statusFilter !== "all") {
      params.set("status", statusFilter)
    }
    if (sorting[0]) {
      params.set("sort", sorting[0].id)
      params.set("order", sorting[0].desc ? "desc" : "asc")
    }
    const response = await fetch(`/api/invites?${params.toString()}`)
    if (!response.ok) {
      toast.error("Unable to load invites.")
      setLoading(false)
      return
    }
    const data = (await response.json()) as ListResponse<InviteRow>
    setInvites(data.items)
    setTotalRows(data.total)
    setLoading(false)
  }, [pagination.pageIndex, pagination.pageSize, search, sorting, statusFilter])

  React.useEffect(() => {
    void loadInvites()
  }, [loadInvites])

  React.useEffect(() => {
    setPagination((prev) =>
      prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 }
    )
  }, [search, sorting, statusFilter])

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

  const sendInvite = async () => {
    setInviting(true)
    clearInviteErrors()
    const response = await fetch("/api/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(inviteValues),
    })

    if (!response.ok) {
      const data = (await response.json()) as {
        error?: string
        details?: { fieldErrors?: Record<string, string[]> }
      }
      setInviteErrorsFromResponse(data)
      toast.error(data.error ?? "Unable to send invite.")
      setInviting(false)
      return
    }

    toast.success("Invite sent.")
    setInviteValues({ email: "", role: "CUSTOMER" })
    setInviting(false)
    setInviteOpen(false)
    await loadInvites()
  }

  const copyInviteLink = async (invite: InviteRow) => {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
    const link = `${appUrl}/auth/invite?token=${invite.token}`
    await navigator.clipboard.writeText(link)
    toast.success("Invite link copied.")
  }

  const revokeInvite = async (inviteId: string) => {
    const response = await fetch(`/api/invites/${inviteId}`, { method: "DELETE" })
    if (!response.ok) {
      toast.error("Unable to revoke invite.")
      return
    }
    toast.success("Invite revoked.")
    setInvites((prev) => prev.filter((invite) => invite.id !== inviteId))
  }

  const columns = React.useMemo<ColumnDef<InviteRow>[]>(
    () => [
      {
        accessorKey: "email",
        meta: { label: "Email" },
        header: ({ column }) => (
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm font-medium"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Email
            <SortIndicator value={column.getIsSorted()} />
          </button>
        ),
      },
      {
        accessorKey: "role",
        meta: { label: "Role" },
        header: ({ column }) => (
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm font-medium"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Role
            <SortIndicator value={column.getIsSorted()} />
          </button>
        ),
      },
      {
        accessorKey: "createdAt",
        meta: { label: "Created" },
        header: ({ column }) => (
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm font-medium"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Created
            <SortIndicator value={column.getIsSorted()} />
          </button>
        ),
        cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
      },
      {
        accessorKey: "expiresAt",
        meta: { label: "Expires" },
        header: ({ column }) => (
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm font-medium"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Expires
            <SortIndicator value={column.getIsSorted()} />
          </button>
        ),
        cell: ({ row }) => new Date(row.original.expiresAt).toLocaleDateString(),
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => {
          const status = row.original.acceptedAt
            ? "Accepted"
            : new Date(row.original.expiresAt) < new Date()
              ? "Expired"
              : "Pending"
          return status
        },
      },
      {
        id: "actions",
        header: "",
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => copyInviteLink(row.original)}
              disabled={Boolean(row.original.acceptedAt)}
            >
              Copy link
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => revokeInvite(row.original.id)}
              disabled={Boolean(row.original.acceptedAt)}
            >
              Revoke
            </Button>
          </div>
        ),
      },
    ],
    []
  )

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: invites,
    columns,
    state: { sorting, columnVisibility, pagination, globalFilter: search },
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
          <h1 className="text-2xl font-semibold">Invites</h1>
          <p className="text-sm text-muted-foreground">
            Track pending invitations and revoke access.
          </p>
        </div>
        <Button onClick={() => setInviteOpen(true)}>Invite user</Button>
      </div>

      <DataTableToolbar table={table} searchPlaceholder="Search by email">
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(
              event.target.value as "all" | "pending" | "accepted" | "expired"
            )
          }
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="accepted">Accepted</option>
          <option value="expired">Expired</option>
        </select>
      </DataTableToolbar>

      <DataTable table={table} loading={loading} emptyMessage="No invites yet." />

      <DataTablePagination table={table} totalRows={totalRows} />

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Invite user</DialogTitle>
            <DialogDescription>
              Send a secure invite link to set a password.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            <div className="grid gap-4">
            <FormField id="invite-email" label="Email" error={inviteErrors.email}>
              <Input
                id="invite-email"
                type="email"
                value={inviteValues.email}
                onChange={(event) =>
                  setInviteValues((prev) => ({ ...prev, email: event.target.value }))
                }
              />
            </FormField>
            <FormField id="invite-role" label="Role" error={inviteErrors.role}>
              <select
                id="invite-role"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={inviteValues.role}
                onChange={(event) =>
                  setInviteValues((prev) => ({
                    ...prev,
                    role: event.target.value as Role,
                  }))
                }
              >
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </FormField>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button onClick={sendInvite} disabled={inviting}>
              {inviting ? "Sending..." : "Send invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
