"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { LeaveGroupFormFields } from "@/app/(protected)/leaves/group-form-fields"
import { defaultLeaveGroupFormValues } from "@/app/(protected)/leaves/group-form-model"
import { Button } from "@/components/ui/button"
import { useFormErrors } from "@/hooks/use-form-errors"
import type { LeaveDefinitionRow, LeaveGroupFormValues } from "@/types/leaves"

type StaffOption = { value: string; label: string }

export default function NewLeaveGroupPage() {
  const router = useRouter()
  const [values, setValues] = React.useState<LeaveGroupFormValues>(defaultLeaveGroupFormValues)
  const [saving, setSaving] = React.useState(false)
  const [leaveOptions, setLeaveOptions] = React.useState<Array<{ value: string; label: string }>>([])
  const [staffOptions, setStaffOptions] = React.useState<StaffOption[]>([])
  const { errors, setErrorsFromResponse, clearErrors } = useFormErrors()

  React.useEffect(() => {
    const loadOptions = async () => {
      const [leaveResponse, staffResponse] = await Promise.all([
        fetch("/api/leaves/definitions?page=1&pageSize=100&status=ACTIVE", { cache: "no-store" }),
        fetch("/api/users?role=STAFF&status=ACTIVE&page=1&pageSize=100", { cache: "no-store" }),
      ])
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
    }
    void loadOptions()
  }, [])

  const createGroup = async () => {
    setSaving(true)
    clearErrors()
    const response = await fetch("/api/leaves/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    })
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as {
        error?: string
        details?: { fieldErrors?: Record<string, string[]> }
      }
      setErrorsFromResponse(data)
      toast.error(data.error ?? "Unable to create leave group.")
      setSaving(false)
      return
    }
    const data = (await response.json()) as { item: { id: string } }
    toast.success("Leave group created.")
    router.push(`/leaves/groups/${data.item.id}`)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">New Leave Group</h1>
          <p className="text-sm text-muted-foreground">
            Add leaves to a group and assign it to all or selected employees.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/leaves/groups">Back to groups</Link>
        </Button>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <LeaveGroupFormFields
          values={values}
          errors={errors}
          onChange={(updater) => setValues((prev) => updater(prev))}
          leaveOptions={leaveOptions}
          staffOptions={staffOptions}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" asChild>
          <Link href="/leaves/groups">Cancel</Link>
        </Button>
        <Button onClick={createGroup} loading={saving} loadingText="Saving...">
          Create group
        </Button>
      </div>
    </div>
  )
}
