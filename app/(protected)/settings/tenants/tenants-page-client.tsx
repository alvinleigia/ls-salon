"use client"

import * as React from "react"
import {
  ColumnDef,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { MoreHorizontalIcon, PlusIcon } from "lucide-react"
import { toast } from "sonner"

import { DataTable, DataTablePagination, DataTableToolbar } from "@/components/data-table"
import { FormField } from "@/components/form-field"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { useFormErrors } from "@/hooks/use-form-errors"
import type { ListResponse } from "@/types/api"

type PaginationState = { pageIndex: number; pageSize: number }
type TenantStatus = "ACTIVE" | "SUSPENDED" | "ARCHIVED"

type TenantRow = {
  id: string
  name: string
  slug: string
  status: TenantStatus
  userCount: number
  createdAt: string
}

type TenantCreateFormValues = {
  name: string
  slug: string
  adminName: string
  adminEmail: string
  adminPassword: string
}

const defaultFormValues: TenantCreateFormValues = {
  name: "",
  slug: "",
  adminName: "",
  adminEmail: "",
  adminPassword: "",
}

const formatDateTime = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleString()
}

export default function TenantsPageClient() {
  const [items, setItems] = React.useState<TenantRow[]>([])
  const [totalRows, setTotalRows] = React.useState(0)
  const [loading, setLoading] = React.useState(true)
  const [creating, setCreating] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<"all" | TenantStatus>("all")
  const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize: 10 })
  const [createOpen, setCreateOpen] = React.useState(false)
  const [lifecycleUpdatingId, setLifecycleUpdatingId] = React.useState<string | null>(null)
  const [adminResettingId, setAdminResettingId] = React.useState<string | null>(null)
  const [pendingStatusChange, setPendingStatusChange] = React.useState<{
    tenant: TenantRow
    status: TenantStatus
  } | null>(null)
  const [formValues, setFormValues] = React.useState<TenantCreateFormValues>(defaultFormValues)
  const { errors, setErrorsFromResponse, clearErrors } = useFormErrors()

  const loadTenants = React.useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set("page", String(pagination.pageIndex + 1))
    params.set("pageSize", String(pagination.pageSize))
    if (search.trim()) params.set("q", search.trim())
    if (statusFilter !== "all") params.set("status", statusFilter)

    const response = await fetch(`/api/tenants?${params.toString()}`, { cache: "no-store" })
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string }
      toast.error(data.error ?? "Unable to load tenants.")
      setItems([])
      setTotalRows(0)
      setLoading(false)
      return
    }
    const data = (await response.json()) as ListResponse<TenantRow>
    setItems(data.items)
    setTotalRows(data.total)
    setLoading(false)
  }, [pagination.pageIndex, pagination.pageSize, search, statusFilter])

  React.useEffect(() => {
    void loadTenants()
  }, [loadTenants])

  React.useEffect(() => {
    setPagination((prev) =>
      prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 }
    )
  }, [search, statusFilter])

  const createTenant = async () => {
    setCreating(true)
    clearErrors()
    const response = await fetch("/api/tenants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formValues),
    })
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as {
        error?: string
        details?: { fieldErrors?: Record<string, string[]> }
      }
      setErrorsFromResponse(data)
      toast.error(data.error ?? "Unable to create tenant.")
      setCreating(false)
      return
    }

    toast.success("Tenant created.")
    setCreating(false)
    setCreateOpen(false)
    setFormValues(defaultFormValues)
    await loadTenants()
  }

  const updateTenantStatus = async (tenant: TenantRow, status: TenantStatus) => {
    setLifecycleUpdatingId(tenant.id)
    const response = await fetch(`/api/tenants/${tenant.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string }
      toast.error(data.error ?? "Unable to update tenant status.")
      setLifecycleUpdatingId(null)
      return
    }
    toast.success(`Tenant moved to ${status}.`)
    setLifecycleUpdatingId(null)
    await loadTenants()
  }

  const sendAdminReset = async (tenant: TenantRow) => {
    setAdminResettingId(tenant.id)
    const response = await fetch(`/api/tenants/${tenant.id}/admin-reset`, {
      method: "POST",
    })
    const data = (await response.json().catch(() => ({}))) as {
      error?: string
      delivery?: "email" | "manual"
      resetUrl?: string
    }
    if (!response.ok) {
      toast.error(data.error ?? "Unable to send admin reset.")
      setAdminResettingId(null)
      return
    }

    if (data.delivery === "manual" && data.resetUrl) {
      try {
        await navigator.clipboard.writeText(data.resetUrl)
        toast.success("Email not configured. Reset link copied to clipboard.")
      } catch {
        toast.success("Email not configured. Reset link returned by API.")
      }
    } else {
      toast.success("Admin reset link sent.")
    }
    setAdminResettingId(null)
  }

  const columns = React.useMemo<ColumnDef<TenantRow>[]>(
    () => [
      {
        id: "name",
        meta: { label: "Name" },
        header: "Name",
        accessorFn: (row) => row.name,
      },
      {
        id: "slug",
        meta: { label: "Slug" },
        header: "Slug",
        accessorFn: (row) => row.slug,
      },
      {
        id: "status",
        meta: { label: "Status" },
        header: "Status",
        accessorFn: (row) => row.status,
      },
      {
        id: "users",
        meta: { label: "Users" },
        header: "Users",
        accessorFn: (row) => row.userCount,
      },
      {
        id: "createdAt",
        meta: { label: "Created" },
        header: "Created",
        accessorFn: (row) => formatDateTime(row.createdAt),
      },
      {
        id: "actions",
        meta: { label: "Actions" },
        header: "",
        cell: ({ row }) => {
          const tenant = row.original
          const canMutate = lifecycleUpdatingId !== tenant.id && adminResettingId !== tenant.id
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" disabled={!canMutate}>
                  <MoreHorizontalIcon className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {tenant.status !== "ACTIVE" ? (
                  <DropdownMenuItem
                    onSelect={() => setPendingStatusChange({ tenant, status: "ACTIVE" })}
                  >
                    Reactivate
                  </DropdownMenuItem>
                ) : null}
                {tenant.status !== "SUSPENDED" ? (
                  <DropdownMenuItem
                    onSelect={() => setPendingStatusChange({ tenant, status: "SUSPENDED" })}
                  >
                    Suspend
                  </DropdownMenuItem>
                ) : null}
                {tenant.status !== "ARCHIVED" ? (
                  <DropdownMenuItem
                    className="text-destructive"
                    onSelect={() => setPendingStatusChange({ tenant, status: "ARCHIVED" })}
                  >
                    Archive
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem onSelect={() => void sendAdminReset(tenant)}>
                  Send admin reset
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
      },
    ],
    [lifecycleUpdatingId, adminResettingId]
  )

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: items,
    columns,
    state: { pagination, globalFilter: search },
    onGlobalFilterChange: setSearch,
    onPaginationChange: (updater) => {
      setPagination((prev) =>
        typeof updater === "function" ? (updater(prev as never) as PaginationState) : updater
      )
    },
    getCoreRowModel: getCoreRowModel(),
    manualFiltering: true,
    manualPagination: true,
    pageCount: Math.max(1, Math.ceil(totalRows / pagination.pageSize)),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Tenants</h1>
          <p className="text-sm text-muted-foreground">
            Provision tenant accounts and assign an initial admin user.
          </p>
        </div>
        <Button
          onClick={() => {
            clearErrors()
            setFormValues(defaultFormValues)
            setCreateOpen(true)
          }}
        >
          <PlusIcon className="mr-2 h-4 w-4" />
          New tenant
        </Button>
      </div>

      <DataTableToolbar table={table} searchPlaceholder="Search name or slug">
        <div className="flex items-end gap-2">
          <FormField id="tenant-status" label="Status">
            <select
              id="tenant-status"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "all" | TenantStatus)}
            >
              <option value="all">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </FormField>
        </div>
      </DataTableToolbar>
      <DataTable table={table} loading={loading} emptyMessage="No tenants found." />
      <DataTablePagination table={table} totalRows={totalRows} />

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open)
          if (!open) {
            clearErrors()
            setFormValues(defaultFormValues)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New tenant</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <FormField id="tenant-name" label="Tenant name" error={errors.name}>
              <Input
                id="tenant-name"
                value={formValues.name}
                onChange={(event) =>
                  setFormValues((prev) => ({ ...prev, name: event.target.value }))
                }
              />
            </FormField>
            <FormField id="tenant-slug" label="Tenant slug" error={errors.slug}>
              <Input
                id="tenant-slug"
                value={formValues.slug}
                onChange={(event) =>
                  setFormValues((prev) => ({
                    ...prev,
                    slug: event.target.value.trim().toLowerCase(),
                  }))
                }
                placeholder="example-tenant"
              />
            </FormField>
            <FormField id="admin-name" label="Admin name" error={errors.adminName}>
              <Input
                id="admin-name"
                value={formValues.adminName}
                onChange={(event) =>
                  setFormValues((prev) => ({ ...prev, adminName: event.target.value }))
                }
              />
            </FormField>
            <FormField id="admin-email" label="Admin email" error={errors.adminEmail}>
              <Input
                id="admin-email"
                type="email"
                value={formValues.adminEmail}
                onChange={(event) =>
                  setFormValues((prev) => ({ ...prev, adminEmail: event.target.value }))
                }
              />
            </FormField>
            <FormField
              id="admin-password"
              label="Temporary password"
              error={errors.adminPassword}
            >
              <Input
                id="admin-password"
                type="password"
                value={formValues.adminPassword}
                onChange={(event) =>
                  setFormValues((prev) => ({ ...prev, adminPassword: event.target.value }))
                }
              />
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void createTenant()} loading={creating} loadingText="Creating...">
              Create tenant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(pendingStatusChange)}
        onOpenChange={(open) => {
          if (!open) setPendingStatusChange(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm status change</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {pendingStatusChange
              ? `Change "${pendingStatusChange.tenant.name}" to ${pendingStatusChange.status}?`
              : ""}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingStatusChange(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!pendingStatusChange) return
                void updateTenantStatus(
                  pendingStatusChange.tenant,
                  pendingStatusChange.status
                )
                setPendingStatusChange(null)
              }}
              loading={Boolean(
                pendingStatusChange &&
                lifecycleUpdatingId === pendingStatusChange.tenant.id
              )}
              loadingText="Updating..."
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
