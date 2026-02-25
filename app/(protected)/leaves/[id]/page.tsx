"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"

import { LeaveDefinitionFormFields } from "@/app/(protected)/leaves/leave-definition-form-fields"
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
import type { LeaveDefinitionFormValues, LeaveDefinitionRow } from "@/types/leaves"

const mapToFormValues = (row: LeaveDefinitionRow): LeaveDefinitionFormValues => ({
  code: row.code,
  name: row.name,
  leaveType: row.leaveType,
  allowedUsers: row.allowedUsers,
  minDaysPerRequest: row.minDaysPerRequest,
  maxDaysPerRequest: row.maxDaysPerRequest,
  allowWithOtherLeaves: row.allowWithOtherLeaves,
  priorEntryAllowed: row.priorEntryAllowed,
  noticeDays: row.noticeDays,
  allowCarryForward: row.allowCarryForward,
  weekOffSingleSideAllowed: row.weekOffSingleSideAllowed,
  weekOffBothSideAllowed: row.weekOffBothSideAllowed,
  holidaySingleSideAllowed: row.holidaySingleSideAllowed,
  holidayBothSideAllowed: row.holidayBothSideAllowed,
  maxPendingRequests: row.maxPendingRequests,
  status: row.status,
  sortOrder: row.sortOrder,
  nonClubbableWithIds: row.nonClubbableWith.map((item) => item.id),
})

export default function LeaveDefinitionDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params.id
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [row, setRow] = React.useState<LeaveDefinitionRow | null>(null)
  const [values, setValues] = React.useState<LeaveDefinitionFormValues | null>(null)
  const [leaveOptions, setLeaveOptions] = React.useState<Array<{ value: string; label: string }>>([])
  const { errors, setErrorsFromResponse, clearErrors } = useFormErrors()

  const load = React.useCallback(async () => {
    setLoading(true)
    const [definitionResponse, optionsResponse] = await Promise.all([
      fetch(`/api/leaves/definitions/${id}`, { cache: "no-store" }),
      fetch("/api/leaves/definitions?page=1&pageSize=100", { cache: "no-store" }),
    ])

    if (!definitionResponse.ok) {
      const data = (await definitionResponse.json().catch(() => ({}))) as { error?: string }
      toast.error(data.error ?? "Unable to load leave definition.")
      setLoading(false)
      return
    }

    const definitionData = (await definitionResponse.json()) as { item: LeaveDefinitionRow }
    setRow(definitionData.item)
    setValues(mapToFormValues(definitionData.item))

    if (optionsResponse.ok) {
      const optionsData = (await optionsResponse.json()) as { items?: LeaveDefinitionRow[] }
      setLeaveOptions(
        (optionsData.items ?? [])
          .filter((item) => item.id !== id)
          .map((item) => ({
            value: item.id,
            label: `${item.code} - ${item.name}`,
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
    const response = await fetch(`/api/leaves/definitions/${id}`, {
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
      toast.error(data.error ?? "Unable to update leave definition.")
      setSaving(false)
      return
    }
    const data = (await response.json()) as { item: LeaveDefinitionRow }
    setRow(data.item)
    setValues(mapToFormValues(data.item))
    toast.success("Leave definition updated.")
    setSaving(false)
  }

  const remove = async () => {
    setDeleting(true)
    const response = await fetch(`/api/leaves/definitions/${id}`, {
      method: "DELETE",
    })
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string }
      toast.error(data.error ?? "Unable to delete leave definition.")
      setDeleting(false)
      return
    }
    toast.success("Leave definition deleted.")
    router.push("/leaves")
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading leave definition...</p>
  }
  if (!row || !values) {
    return <p className="text-sm text-muted-foreground">Leave definition not found.</p>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{row.name}</h1>
          <p className="text-sm text-muted-foreground">Code: {row.code}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/leaves">Back to list</Link>
          </Button>
          <Button
            variant="destructive"
            onClick={() => setDeleteOpen(true)}
            loading={deleting}
            loadingText="Deleting..."
          >
            Delete
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <LeaveDefinitionFormFields
          values={values}
          errors={errors}
          onChange={(updater) => setValues((prev) => (prev ? updater(prev) : prev))}
          leaveOptions={leaveOptions}
          disableCode={false}
        />
      </div>

      <div className="flex justify-end">
        <Button onClick={save} loading={saving} loadingText="Saving...">
          Save changes
        </Button>
      </div>

      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!deleting) setDeleteOpen(open)
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete leave definition</DialogTitle>
            <DialogDescription>
              Delete &quot;{row.name}&quot;? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={deleting}
              onClick={() => setDeleteOpen(false)}
            >
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
