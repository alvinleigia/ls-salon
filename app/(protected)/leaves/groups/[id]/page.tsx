"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"

import { LeaveGroupFormFields } from "@/app/(protected)/leaves/group-form-fields"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useFormErrors } from "@/hooks/use-form-errors"
import type { LeaveDefinitionRow, LeaveGroupFormValues, LeaveGroupRow } from "@/types/leaves"

const toFormValues = (row: LeaveGroupRow): LeaveGroupFormValues => ({
  code: row.code,
  name: row.name,
  description: row.description ?? "",
  assignmentMode: row.assignmentMode,
  status: row.status,
  sortOrder: row.sortOrder,
  leaveDefinitionIds: row.leaveDefinitions.map((item) => item.id),
  staffIds: row.assignedStaff.map((item) => item.userId),
})

export default function LeaveGroupDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params.id
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [row, setRow] = React.useState<LeaveGroupRow | null>(null)
  const [values, setValues] = React.useState<LeaveGroupFormValues | null>(null)
  const [leaveOptions, setLeaveOptions] = React.useState<Array<{ value: string; label: string }>>([])
  const [staffOptions, setStaffOptions] = React.useState<Array<{ value: string; label: string }>>([])
  const { errors, setErrorsFromResponse, clearErrors } = useFormErrors()

  const load = React.useCallback(async () => {
    setLoading(true)
    const [groupResponse, leaveResponse, staffResponse] = await Promise.all([
      fetch(`/api/leaves/groups/${id}`, { cache: "no-store" }),
      fetch("/api/leaves/definitions?page=1&pageSize=100&status=ACTIVE", { cache: "no-store" }),
      fetch("/api/users?role=STAFF&status=ACTIVE&page=1&pageSize=100", { cache: "no-store" }),
    ])
    if (!groupResponse.ok) {
      const data = (await groupResponse.json().catch(() => ({}))) as { error?: string }
      toast.error(data.error ?? "Unable to load leave group.")
      setLoading(false)
      return
    }
    const groupData = (await groupResponse.json()) as { item: LeaveGroupRow }
    setRow(groupData.item)
    setValues(toFormValues(groupData.item))

    if (leaveResponse.ok) {
      const leaveData = (await leaveResponse.json()) as { items?: LeaveDefinitionRow[] }
      setLeaveOptions(
        (leaveData.items ?? []).map((item) => ({
          value: item.id,
          label: `${item.code} - ${item.name}`,
        }))
      )
    }
    if (staffResponse.ok) {
      const staffData = (await staffResponse.json()) as {
        items?: Array<{ id: string; name: string | null; email: string }>
      }
      setStaffOptions(
        (staffData.items ?? []).map((item) => ({
          value: item.id,
          label: item.name?.trim() || item.email,
        }))
      )
    }
    setLoading(false)
  }, [id])

  React.useEffect(() => {
    void load()
  }, [load])

  const save = async () => {
    if (!values) return
    setSaving(true)
    clearErrors()
    const response = await fetch(`/api/leaves/groups/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    })
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as {
        error?: string
        details?: { fieldErrors?: Record<string, string[]> }
      }
      setErrorsFromResponse(data)
      toast.error(data.error ?? "Unable to update leave group.")
      setSaving(false)
      return
    }
    const data = (await response.json()) as { item: LeaveGroupRow }
    setRow(data.item)
    setValues(toFormValues(data.item))
    toast.success("Leave group updated.")
    setSaving(false)
  }

  const remove = async () => {
    setDeleting(true)
    const response = await fetch(`/api/leaves/groups/${id}`, { method: "DELETE" })
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string }
      toast.error(data.error ?? "Unable to delete leave group.")
      setDeleting(false)
      return
    }
    toast.success("Leave group deleted.")
    router.push("/leaves/groups")
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading leave group...</p>
  if (!row || !values) return <p className="text-sm text-muted-foreground">Leave group not found.</p>

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{row.name}</h1>
          <p className="text-sm text-muted-foreground">Code: {row.code}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/leaves/groups">Back to groups</Link>
          </Button>
          <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
            Delete
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <LeaveGroupFormFields
          values={values}
          errors={errors}
          onChange={(updater) => setValues((prev) => (prev ? updater(prev) : prev))}
          leaveOptions={leaveOptions}
          staffOptions={staffOptions}
        />
      </div>

      <div className="flex justify-end">
        <Button onClick={save} loading={saving} loadingText="Saving...">
          Save changes
        </Button>
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete leave group</DialogTitle>
            <DialogDescription>
              Delete &quot;{row.name}&quot;? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={deleting} onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={remove}
              loading={deleting}
              loadingText="Deleting..."
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
