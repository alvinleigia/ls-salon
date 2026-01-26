"use client"

import * as React from "react"
import { useSession } from "next-auth/react"
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table"
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  MoreHorizontalIcon,
} from "lucide-react"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  DataTable,
  DataTablePagination,
  DataTableToolbar,
} from "@/components/data-table"
import { FormField } from "@/components/form-field"
import { useFormErrors } from "@/hooks/use-form-errors"
import { canInvite, type Role } from "@/lib/permissions"
import type { ListResponse } from "@/types/api"


type Gender = "MALE" | "FEMALE" | "NON_BINARY" | "OTHER" | "PREFER_NOT_TO_SAY"
type UserStatus = "ACTIVE" | "SUSPENDED" | "INVITED" | "ARCHIVED"

type UserRow = {
  id: string
  name: string | null
  email: string
  phone: string | null
  image?: string | null
  dateOfBirth?: string | null
  gender?: Gender | null
  status?: UserStatus | null
  lastLoginAt?: string | null
  marketingOptIn?: boolean | null
  addressLine1?: string | null
  addressLine2?: string | null
  city?: string | null
  state?: string | null
  postalCode?: string | null
  country?: string | null
  role: Role
  createdAt: string
}

const roleOptions: Role[] = ["ADMIN", "MANAGER", "STAFF", "CUSTOMER"]
const genderOptions: Gender[] = [
  "MALE",
  "FEMALE",
  "NON_BINARY",
  "OTHER",
  "PREFER_NOT_TO_SAY",
]
const statusOptions: UserStatus[] = ["ACTIVE", "SUSPENDED", "INVITED", "ARCHIVED"]

const toDateInput = (value?: string | null) =>
  value ? value.slice(0, 10) : ""

const SortIndicator = ({ value }: { value: false | "asc" | "desc" }) => {
  if (value === "asc") return <ArrowUpIcon className="h-4 w-4" />
  if (value === "desc") return <ArrowDownIcon className="h-4 w-4" />
  return <ArrowUpDownIcon className="h-4 w-4" />
}

export default function UsersPage() {
  type PaginationState = { pageIndex: number; pageSize: number }

  const { data: session } = useSession()
  const currentRole = (session?.user as { role?: Role })?.role ?? null
  const canManage = canInvite(currentRole)
  const sessionUserId = session?.user?.id

  const [search, setSearch] = React.useState("")
  const [roleFilter, setRoleFilter] = React.useState<"all" | Role>("all")
  const [statusFilter, setStatusFilter] = React.useState<"all" | UserStatus>("all")

  const [users, setUsers] = React.useState<UserRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [creating, setCreating] = React.useState(false)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [editOpen, setEditOpen] = React.useState(false)
  const [editingUser, setEditingUser] = React.useState<UserRow | null>(null)
  const {
    errors: createErrors,
    setErrorsFromResponse: setCreateErrorsFromResponse,
    clearErrors: clearCreateErrors,
  } = useFormErrors()
  const {
    errors: editErrors,
    setErrorsFromResponse: setEditErrorsFromResponse,
    clearErrors: clearEditErrors,
  } = useFormErrors()
  const [totalRows, setTotalRows] = React.useState(0)

  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({
    name: true,
    email: true,
    phone: true,
    role: true,
    status: true,
  })
  const [pagination, setPagination] = React.useState({ pageIndex: 0, pageSize: 10 })

  const [newUser, setNewUser] = React.useState({
    name: "",
    email: "",
    phone: "",
    image: "",
    dateOfBirth: "",
    gender: "PREFER_NOT_TO_SAY" as Gender,
    status: "ACTIVE" as UserStatus,
    marketingOptIn: false,
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
    role: "CUSTOMER" as Role,
    password: "",
  })

  const [editValues, setEditValues] = React.useState({
    name: "",
    email: "",
    phone: "",
    image: "",
    dateOfBirth: "",
    gender: "PREFER_NOT_TO_SAY" as Gender,
    status: "ACTIVE" as UserStatus,
    marketingOptIn: false,
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
    role: "CUSTOMER" as Role,
    password: "",
  })

  const totalPages = Math.max(1, Math.ceil(totalRows / pagination.pageSize))

  const loadUsers = React.useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    params.set("page", String(pagination.pageIndex + 1))
    params.set("pageSize", String(pagination.pageSize))
    if (search) {
      params.set("q", search)
    }
    if (roleFilter !== "all") {
      params.set("role", roleFilter)
    }
    if (statusFilter !== "all") {
      params.set("status", statusFilter)
    }
    if (sorting[0]) {
      params.set("sort", sorting[0].id)
      params.set("order", sorting[0].desc ? "desc" : "asc")
    }
    const response = await fetch(`/api/users?${params.toString()}`)
    if (!response.ok) {
      toast.error("Unable to load users.")
      setUsers([])
      setTotalRows(0)
      setLoading(false)
      return
    }
    const data = (await response.json()) as ListResponse<UserRow>
    setUsers(data.items)
    setTotalRows(data.total)
    setLoading(false)
  }, [
    pagination.pageIndex,
    pagination.pageSize,
    roleFilter,
    search,
    sorting,
    statusFilter,
  ])

  React.useEffect(() => {
    void loadUsers()
  }, [loadUsers])


  React.useEffect(() => {
    setPagination((prev) =>
      prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 }
    )
  }, [roleFilter, search, sorting, statusFilter])

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

  const startEdit = React.useCallback((user: UserRow) => {
    setEditingUser(user)
    clearEditErrors()
    setEditValues({
      name: user.name ?? "",
      email: user.email,
      phone: user.phone ?? "",
      image: user.image ?? "",
      dateOfBirth: toDateInput(user.dateOfBirth),
      gender: user.gender ?? "PREFER_NOT_TO_SAY",
      status: user.status ?? "ACTIVE",
      marketingOptIn: user.role === "STAFF" ? false : Boolean(user.marketingOptIn),
      addressLine1: user.addressLine1 ?? "",
      addressLine2: user.addressLine2 ?? "",
      city: user.city ?? "",
      state: user.state ?? "",
      postalCode: user.postalCode ?? "",
      country: user.country ?? "",
      role: user.role,
      password: "",
    })
    setEditOpen(true)
  }, [clearEditErrors])

  const saveEdit = async () => {
    if (!editingUser) return
    const response = await fetch(`/api/users/${editingUser.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editValues),
    })

    if (!response.ok) {
      const data = (await response.json()) as {
        error?: string
        details?: { fieldErrors?: Record<string, string[]> }
      }
      setEditErrorsFromResponse(data)
      toast.error(data.error ?? "Unable to update user.")
      return
    }

    toast.success("User updated.")
    setEditOpen(false)
    setEditingUser(null)
    await loadUsers()
  }

  const createUser = async () => {
    if (!canManage) return
    setCreating(true)
    clearCreateErrors()
    const response = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newUser),
    })

    if (!response.ok) {
      const data = (await response.json()) as {
        error?: string
        details?: { fieldErrors?: Record<string, string[]> }
      }
      setCreateErrorsFromResponse(data)
      toast.error(data.error ?? "Unable to create user.")
      setCreating(false)
      return
    }

    toast.success("User created.")
    setNewUser({
      name: "",
      email: "",
      phone: "",
      image: "",
      dateOfBirth: "",
      gender: "PREFER_NOT_TO_SAY",
      status: "ACTIVE",
      marketingOptIn: false,
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      postalCode: "",
      country: "",
      role: "CUSTOMER",
      password: "",
    })
    setCreating(false)
    setCreateOpen(false)
    await loadUsers()
  }

  const canEditUser = React.useCallback(
    (user: UserRow) => canManage || sessionUserId === user.id,
    [canManage, sessionUserId]
  )

  const canEditProfile =
    canManage || Boolean(editingUser && sessionUserId === editingUser.id)

  const columns = React.useMemo<ColumnDef<UserRow>[]>(
    () => [
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
        cell: ({ row }) => (
          <button
            type="button"
            className="text-left text-sm font-medium text-primary underline-offset-4 hover:underline"
            onClick={() => window.location.assign(`/users/${row.original.id}`)}
          >
            {row.original.name ?? "-"}
          </button>
        ),
      },
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
        accessorKey: "phone",
        meta: { label: "Phone" },
        header: ({ column }) => (
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm font-medium"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Phone
            <SortIndicator value={column.getIsSorted()} />
          </button>
        ),
        cell: ({ row }) => row.original.phone ?? "-",
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
        filterFn: (row, id, value) => (value ? row.getValue(id) === value : true),
      },
      {
        accessorKey: "status",
        meta: { label: "Status" },
        header: ({ column }) => (
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm font-medium"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Status
            <SortIndicator value={column.getIsSorted()} />
          </button>
        ),
        cell: ({ row }) => row.original.status ?? "ACTIVE",
        filterFn: (row, id, value) => (value ? row.getValue(id) === value : true),
      },
      {
        id: "actions",
        header: "",
        enableHiding: false,
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" disabled={!canEditUser(row.original)}>
                <MoreHorizontalIcon className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => window.location.assign(`/users/${row.original.id}`)}
              >
                View
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => startEdit(row.original)}
                disabled={!canEditUser(row.original)}
              >
                Edit
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [canEditUser, startEdit]
  )

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: users,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter: search,
      pagination,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setSearch,
    onPaginationChange: handlePaginationChange,
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    pageCount: totalPages,
    getCoreRowModel: getCoreRowModel(),
  })

  const handleRoleFilter = (value: "all" | Role) => {
    setRoleFilter(value)
    table.getColumn("role")?.setFilterValue(value === "all" ? undefined : value)
  }

  const handleStatusFilter = (value: "all" | UserStatus) => {
    setStatusFilter(value)
    table.getColumn("status")?.setFilterValue(value === "all" ? undefined : value)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Users</h1>
          <p className="text-sm text-muted-foreground">
            Manage users, roles, and password resets.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setCreateOpen(true)} disabled={!canManage}>
            New user
          </Button>
        </div>
      </div>

      <DataTableToolbar table={table} searchPlaceholder="Search by name, email, or phone">
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={roleFilter}
          onChange={(event) => handleRoleFilter(event.target.value as Role | "all")}
        >
          <option value="all">All roles</option>
          {roleOptions.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={statusFilter}
          onChange={(event) => handleStatusFilter(event.target.value as UserStatus | "all")}
        >
          <option value="all">All status</option>
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {status.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </DataTableToolbar>

      <DataTable table={table} loading={loading} emptyMessage="No users found." />

      <DataTablePagination table={table} totalRows={totalRows} />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Create user</DialogTitle>
            <DialogDescription>
              Add a new user and assign a role.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="create-name" label="Full name" error={createErrors.name}>
              <Input
                id="create-name"
                value={newUser.name}
                onChange={(event) =>
                  setNewUser((prev) => ({ ...prev, name: event.target.value }))
                }
              />
            </FormField>
            <FormField id="create-email" label="Email" error={createErrors.email}>
              <Input
                id="create-email"
                type="email"
                value={newUser.email}
                onChange={(event) =>
                  setNewUser((prev) => ({ ...prev, email: event.target.value }))
                }
              />
            </FormField>
            <FormField id="create-phone" label="Mobile" error={createErrors.phone}>
              <Input
                id="create-phone"
                type="tel"
                value={newUser.phone}
                onChange={(event) =>
                  setNewUser((prev) => ({ ...prev, phone: event.target.value }))
                }
              />
            </FormField>
            <FormField
              id="create-image"
              label="Profile image URL"
              error={createErrors.image}
            >
              <Input
                id="create-image"
                type="url"
                value={newUser.image}
                onChange={(event) =>
                  setNewUser((prev) => ({ ...prev, image: event.target.value }))
                }
              />
            </FormField>
            <FormField
              id="create-dob"
              label="Date of birth"
              error={createErrors.dateOfBirth}
            >
              <Input
                id="create-dob"
                type="date"
                value={newUser.dateOfBirth}
                onChange={(event) =>
                  setNewUser((prev) => ({
                    ...prev,
                    dateOfBirth: event.target.value,
                  }))
                }
              />
            </FormField>
            <FormField id="create-gender" label="Gender" error={createErrors.gender}>
              <select
                id="create-gender"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={newUser.gender}
                onChange={(event) =>
                  setNewUser((prev) => ({
                    ...prev,
                    gender: event.target.value as Gender,
                  }))
                }
              >
                {genderOptions.map((gender) => (
                  <option key={gender} value={gender}>
                    {gender.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField id="create-status" label="Status" error={createErrors.status}>
              <select
                id="create-status"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={newUser.status}
                onChange={(event) =>
                  setNewUser((prev) => ({
                    ...prev,
                    status: event.target.value as UserStatus,
                  }))
                }
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField id="create-role" label="Role" error={createErrors.role}>
              <select
                id="create-role"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={newUser.role}
                onChange={(event) =>
                  setNewUser((prev) => ({
                    ...prev,
                    role: event.target.value as Role,
                    marketingOptIn:
                      event.target.value === "STAFF" ? false : prev.marketingOptIn,
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
            <FormField
              id="create-password"
              label="Temporary password"
              error={createErrors.password}
              className="sm:col-span-2"
            >
              <Input
                id="create-password"
                type="password"
                value={newUser.password}
                onChange={(event) =>
                  setNewUser((prev) => ({ ...prev, password: event.target.value }))
                }
              />
            </FormField>
            <div className="space-y-2 sm:col-span-2">
              <Label>Address</Label>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  placeholder="Address line 1"
                  value={newUser.addressLine1}
                  onChange={(event) =>
                    setNewUser((prev) => ({
                      ...prev,
                      addressLine1: event.target.value,
                    }))
                  }
                />
                <Input
                  placeholder="Address line 2"
                  value={newUser.addressLine2}
                  onChange={(event) =>
                    setNewUser((prev) => ({
                      ...prev,
                      addressLine2: event.target.value,
                    }))
                  }
                />
                <Input
                  placeholder="City"
                  value={newUser.city}
                  onChange={(event) =>
                    setNewUser((prev) => ({ ...prev, city: event.target.value }))
                  }
                />
                <Input
                  placeholder="State"
                  value={newUser.state}
                  onChange={(event) =>
                    setNewUser((prev) => ({ ...prev, state: event.target.value }))
                  }
                />
                <Input
                  placeholder="Postal code"
                  value={newUser.postalCode}
                  onChange={(event) =>
                    setNewUser((prev) => ({
                      ...prev,
                      postalCode: event.target.value,
                    }))
                  }
                />
                <Input
                  placeholder="Country"
                  value={newUser.country}
                  onChange={(event) =>
                    setNewUser((prev) => ({ ...prev, country: event.target.value }))
                  }
                />
              </div>
            </div>
            {newUser.role !== "STAFF" ? (
              <div className="sm:col-span-2 flex items-center gap-2">
                <input
                  id="create-marketing"
                  type="checkbox"
                  checked={newUser.marketingOptIn}
                  onChange={(event) =>
                    setNewUser((prev) => ({
                      ...prev,
                      marketingOptIn: event.target.checked,
                    }))
                  }
                />
                <Label htmlFor="create-marketing">Marketing opt-in</Label>
              </div>
            ) : null}
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createUser} disabled={creating}>
              {creating ? "Creating..." : "Create user"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open)
          if (!open) {
            setEditingUser(null)
            clearEditErrors()
          }
        }}
      >
        <DialogContent className="max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit user</DialogTitle>
            <DialogDescription>Update details or reset a password.</DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="edit-name" label="Full name" error={editErrors.name}>
              <Input
                id="edit-name"
                value={editValues.name}
                onChange={(event) =>
                  setEditValues((prev) => ({ ...prev, name: event.target.value }))
                }
                disabled={!canManage && !canEditProfile}
              />
            </FormField>
            <FormField id="edit-email" label="Email" error={editErrors.email}>
              <Input
                id="edit-email"
                type="email"
                value={editValues.email}
                onChange={(event) =>
                  setEditValues((prev) => ({ ...prev, email: event.target.value }))
                }
                disabled={!canManage}
              />
            </FormField>
            <FormField id="edit-phone" label="Mobile" error={editErrors.phone}>
              <Input
                id="edit-phone"
                type="tel"
                value={editValues.phone}
                onChange={(event) =>
                  setEditValues((prev) => ({ ...prev, phone: event.target.value }))
                }
                disabled={!canManage && !canEditProfile}
              />
            </FormField>
            <FormField
              id="edit-image"
              label="Profile image URL"
              error={editErrors.image}
            >
              <Input
                id="edit-image"
                type="url"
                value={editValues.image}
                onChange={(event) =>
                  setEditValues((prev) => ({ ...prev, image: event.target.value }))
                }
                disabled={!canManage && !canEditProfile}
              />
            </FormField>
            <FormField
              id="edit-dob"
              label="Date of birth"
              error={editErrors.dateOfBirth}
            >
              <Input
                id="edit-dob"
                type="date"
                value={editValues.dateOfBirth}
                onChange={(event) =>
                  setEditValues((prev) => ({
                    ...prev,
                    dateOfBirth: event.target.value,
                  }))
                }
                disabled={!canManage && !canEditProfile}
              />
            </FormField>
            <FormField id="edit-gender" label="Gender" error={editErrors.gender}>
              <select
                id="edit-gender"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={editValues.gender}
                onChange={(event) =>
                  setEditValues((prev) => ({
                    ...prev,
                    gender: event.target.value as Gender,
                  }))
                }
                disabled={!canManage && !canEditProfile}
              >
                {genderOptions.map((gender) => (
                  <option key={gender} value={gender}>
                    {gender.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField id="edit-status" label="Status" error={editErrors.status}>
              <select
                id="edit-status"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={editValues.status}
                onChange={(event) =>
                  setEditValues((prev) => ({
                    ...prev,
                    status: event.target.value as UserStatus,
                  }))
                }
                disabled={!canManage}
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField id="edit-role" label="Role" error={editErrors.role}>
              <select
                id="edit-role"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={editValues.role}
                onChange={(event) =>
                  setEditValues((prev) => ({
                    ...prev,
                    role: event.target.value as Role,
                    marketingOptIn:
                      event.target.value === "STAFF" ? false : prev.marketingOptIn,
                  }))
                }
                disabled={!canManage}
              >
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField
              id="edit-password"
              label="Reset password (optional)"
              error={editErrors.password}
              className="sm:col-span-2"
            >
              <Input
                id="edit-password"
                type="password"
                value={editValues.password}
                onChange={(event) =>
                  setEditValues((prev) => ({
                    ...prev,
                    password: event.target.value,
                  }))
                }
                disabled={!canManage}
              />
            </FormField>
            <div className="space-y-2 sm:col-span-2">
              <Label>Address</Label>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  placeholder="Address line 1"
                  value={editValues.addressLine1}
                  onChange={(event) =>
                    setEditValues((prev) => ({
                      ...prev,
                      addressLine1: event.target.value,
                    }))
                  }
                  disabled={!canManage && !canEditProfile}
                />
                <Input
                  placeholder="Address line 2"
                  value={editValues.addressLine2}
                  onChange={(event) =>
                    setEditValues((prev) => ({
                      ...prev,
                      addressLine2: event.target.value,
                    }))
                  }
                  disabled={!canManage && !canEditProfile}
                />
                <Input
                  placeholder="City"
                  value={editValues.city}
                  onChange={(event) =>
                    setEditValues((prev) => ({ ...prev, city: event.target.value }))
                  }
                  disabled={!canManage && !canEditProfile}
                />
                <Input
                  placeholder="State"
                  value={editValues.state}
                  onChange={(event) =>
                    setEditValues((prev) => ({ ...prev, state: event.target.value }))
                  }
                  disabled={!canManage && !canEditProfile}
                />
                <Input
                  placeholder="Postal code"
                  value={editValues.postalCode}
                  onChange={(event) =>
                    setEditValues((prev) => ({
                      ...prev,
                      postalCode: event.target.value,
                    }))
                  }
                  disabled={!canManage && !canEditProfile}
                />
                <Input
                  placeholder="Country"
                  value={editValues.country}
                  onChange={(event) =>
                    setEditValues((prev) => ({
                      ...prev,
                      country: event.target.value,
                    }))
                  }
                  disabled={!canManage && !canEditProfile}
                />
              </div>
            </div>
            {editValues.role !== "STAFF" ? (
              <div className="sm:col-span-2 flex items-center gap-2">
                <input
                  id="edit-marketing"
                  type="checkbox"
                  checked={editValues.marketingOptIn}
                  onChange={(event) =>
                    setEditValues((prev) => ({
                      ...prev,
                      marketingOptIn: event.target.checked,
                    }))
                  }
                  disabled={!canManage && !canEditProfile}
                />
                <Label htmlFor="edit-marketing">Marketing opt-in</Label>
              </div>
            ) : null}
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveEdit}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
