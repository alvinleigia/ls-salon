"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FormField } from "@/components/form-field"
import { useFormErrors } from "@/hooks/use-form-errors"

type SettingsForm = {
  locale: string
  currency: string
  timeZone: string
  dateFormat: string
}

const defaultSettings: SettingsForm = {
  locale: "en-US",
  currency: "USD",
  timeZone: "America/New_York",
  dateFormat: "MM/dd/yyyy",
}

export default function SettingsPage() {
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [form, setForm] = React.useState<SettingsForm>(defaultSettings)
  const { errors, setErrorsFromResponse, clearErrors } = useFormErrors()

  React.useEffect(() => {
    const load = async () => {
      setLoading(true)
      const response = await fetch("/api/settings", { cache: "no-store" })
      if (!response.ok) {
        toast.error("Unable to load settings.")
        setLoading(false)
        return
      }
      const data = (await response.json()) as { settings: SettingsForm }
      setForm(data.settings ?? defaultSettings)
      setLoading(false)
    }
    void load()
  }, [])

  const updateField = (key: keyof SettingsForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const save = async () => {
    setSaving(true)
    clearErrors()
    const response = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })

    if (!response.ok) {
      const data = (await response.json()) as {
        error?: string
        details?: { fieldErrors?: Record<string, string[]> }
      }
      setErrorsFromResponse(data)
      toast.error(data.error ?? "Unable to update settings.")
      setSaving(false)
      return
    }

    const data = (await response.json()) as { settings?: SettingsForm }
    if (data.settings) {
      setForm(data.settings)
    }
    toast.success("Settings updated.")
    setSaving(false)
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading settings...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure localization and formatting defaults.
        </p>
      </div>

      <div className="rounded-xl border bg-card p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="settings-locale" label="Locale" error={errors.locale}>
            <Input
              id="settings-locale"
              value={form.locale}
              onChange={(event) => updateField("locale", event.target.value)}
            />
          </FormField>
          <FormField id="settings-currency" label="Currency" error={errors.currency}>
            <Input
              id="settings-currency"
              value={form.currency}
              onChange={(event) =>
                updateField("currency", event.target.value.toUpperCase())
              }
            />
          </FormField>
          <FormField id="settings-timezone" label="Time zone" error={errors.timeZone}>
            <Input
              id="settings-timezone"
              value={form.timeZone}
              onChange={(event) => updateField("timeZone", event.target.value)}
            />
          </FormField>
          <FormField
            id="settings-date-format"
            label="Date format"
            error={errors.dateFormat}
          >
            <Input
              id="settings-date-format"
              value={form.dateFormat}
              onChange={(event) => updateField("dateFormat", event.target.value)}
            />
          </FormField>
        </div>
        <div className="mt-6 flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save settings"}
          </Button>
        </div>
      </div>
    </div>
  )
}
