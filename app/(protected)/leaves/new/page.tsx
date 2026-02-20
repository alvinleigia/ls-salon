"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { LeaveDefinitionFormFields } from "@/app/(protected)/leaves/leave-definition-form-fields"
import { defaultLeaveDefinitionFormValues } from "@/app/(protected)/leaves/leave-definition-form-model"
import { Button } from "@/components/ui/button"
import { useFormErrors } from "@/hooks/use-form-errors"
import type { LeaveDefinitionFormValues, LeaveDefinitionRow } from "@/types/leaves"

export default function NewLeaveDefinitionPage() {
  const router = useRouter()
  const [values, setValues] = React.useState<LeaveDefinitionFormValues>(
    defaultLeaveDefinitionFormValues
  )
  const [saving, setSaving] = React.useState(false)
  const [leaveOptions, setLeaveOptions] = React.useState<Array<{ value: string; label: string }>>([])
  const { errors, setErrorsFromResponse, clearErrors } = useFormErrors()

  React.useEffect(() => {
    const loadOptions = async () => {
      const response = await fetch("/api/leaves/definitions?page=1&pageSize=100", { cache: "no-store" })
      if (!response.ok) return
      const data = (await response.json()) as { items?: LeaveDefinitionRow[] }
      setLeaveOptions(
        (data.items ?? []).map((item) => ({
          value: item.id,
          label: `${item.code} - ${item.name}`,
        }))
      )
    }
    void loadOptions()
  }, [])

  const createDefinition = async () => {
    setSaving(true)
    clearErrors()
    const response = await fetch("/api/leaves/definitions", {
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
      toast.error(data.error ?? "Unable to create leave definition.")
      setSaving(false)
      return
    }

    const data = (await response.json()) as { item: LeaveDefinitionRow }
    toast.success("Leave definition created.")
    router.push(`/leaves/${data.item.id}`)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">New Leave Definition</h1>
          <p className="text-sm text-muted-foreground">
            Configure a leave definition without hardcoded leave categories.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/leaves">Back to list</Link>
        </Button>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <LeaveDefinitionFormFields
          values={values}
          errors={errors}
          onChange={(updater) => setValues((prev) => updater(prev))}
          leaveOptions={leaveOptions}
        />
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" asChild>
          <Link href="/leaves">Cancel</Link>
        </Button>
        <Button onClick={createDefinition} loading={saving} loadingText="Saving...">
          Create leave definition
        </Button>
      </div>
    </div>
  )
}
