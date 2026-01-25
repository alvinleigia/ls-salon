"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FormField } from "@/components/form-field"
import { useFormErrors } from "@/hooks/use-form-errors"

type Gender = "MALE" | "FEMALE" | "NON_BINARY" | "OTHER" | "PREFER_NOT_TO_SAY"

type UserProfile = {
  id: string
  name: string | null
  email: string
  phone: string | null
  image: string | null
  gender: Gender | null
  dateOfBirth: string | null
  marketingOptIn: boolean | null
  addressLine1: string | null
  addressLine2: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  country: string | null
}

const genderOptions: Gender[] = [
  "MALE",
  "FEMALE",
  "NON_BINARY",
  "OTHER",
  "PREFER_NOT_TO_SAY",
]

const toDateInput = (value?: string | null) => (value ? value.slice(0, 10) : "")

export default function MyProfilePage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const userId = session?.user?.id

  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const { errors, setErrorsFromResponse, clearErrors } = useFormErrors()
  const [form, setForm] = React.useState({
    name: "",
    email: "",
    phone: "",
    image: "",
    dateOfBirth: "",
    gender: "PREFER_NOT_TO_SAY" as Gender,
    marketingOptIn: false,
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
  })

  React.useEffect(() => {
    if (status === "loading") return
    if (!userId) {
      setLoading(false)
      return
    }
    const load = async () => {
      setLoading(true)
      const response = await fetch(`/api/users/${userId}`)
      if (!response.ok) {
        toast.error("Unable to load your profile.")
        setLoading(false)
        return
      }
      const data = (await response.json()) as { user: UserProfile }
      const profile = data.user
      setForm({
        name: profile.name ?? "",
        email: profile.email,
        phone: profile.phone ?? "",
        image: profile.image ?? "",
        dateOfBirth: toDateInput(profile.dateOfBirth),
        gender: profile.gender ?? "PREFER_NOT_TO_SAY",
        marketingOptIn: Boolean(profile.marketingOptIn),
        addressLine1: profile.addressLine1 ?? "",
        addressLine2: profile.addressLine2 ?? "",
        city: profile.city ?? "",
        state: profile.state ?? "",
        postalCode: profile.postalCode ?? "",
        country: profile.country ?? "",
      })
      setLoading(false)
    }
    void load()
  }, [status, userId])

  const updateField = (key: keyof typeof form, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const saveProfile = async () => {
    if (!userId) return
    setSaving(true)
    clearErrors()
    const response = await fetch(`/api/users/${userId}`, {
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
      toast.error(data.error ?? "Unable to update profile.")
      setSaving(false)
      return
    }

    toast.success("Profile updated.")
    setSaving(false)
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading profile...</div>
  }

  if (!userId) {
    return (
      <div className="text-sm text-muted-foreground">
        Unable to load profile.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">My profile</h1>
          <p className="text-sm text-muted-foreground">
            Update your personal information.
          </p>
        </div>
        <Button variant="outline" onClick={() => router.back()}>
          Back
        </Button>
      </div>

      <div className="rounded-xl border bg-card p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="me-name" label="Full name" error={errors.name}>
            <Input
              id="me-name"
              value={form.name}
              onChange={(event) => updateField("name", event.target.value)}
            />
          </FormField>
          <FormField id="me-email" label="Email">
            <Input id="me-email" value={form.email} disabled />
          </FormField>
          <FormField id="me-phone" label="Mobile" error={errors.phone}>
            <Input
              id="me-phone"
              type="tel"
              value={form.phone}
              onChange={(event) => updateField("phone", event.target.value)}
            />
          </FormField>
          <FormField id="me-image" label="Profile image URL" error={errors.image}>
            <Input
              id="me-image"
              type="url"
              value={form.image}
              onChange={(event) => updateField("image", event.target.value)}
            />
          </FormField>
          <FormField id="me-dob" label="Date of birth" error={errors.dateOfBirth}>
            <Input
              id="me-dob"
              type="date"
              value={form.dateOfBirth}
              onChange={(event) => updateField("dateOfBirth", event.target.value)}
            />
          </FormField>
          <FormField id="me-gender" label="Gender" error={errors.gender}>
            <select
              id="me-gender"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={form.gender}
              onChange={(event) => updateField("gender", event.target.value)}
            >
              {genderOptions.map((gender) => (
                <option key={gender} value={gender}>
                  {gender.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </FormField>
          <div className="space-y-2 sm:col-span-2">
            <Label>Address</Label>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                placeholder="Address line 1"
                value={form.addressLine1}
                onChange={(event) =>
                  updateField("addressLine1", event.target.value)
                }
              />
              <Input
                placeholder="Address line 2"
                value={form.addressLine2}
                onChange={(event) =>
                  updateField("addressLine2", event.target.value)
                }
              />
              <Input
                placeholder="City"
                value={form.city}
                onChange={(event) => updateField("city", event.target.value)}
              />
              <Input
                placeholder="State"
                value={form.state}
                onChange={(event) => updateField("state", event.target.value)}
              />
              <Input
                placeholder="Postal code"
                value={form.postalCode}
                onChange={(event) =>
                  updateField("postalCode", event.target.value)
                }
              />
              <Input
                placeholder="Country"
                value={form.country}
                onChange={(event) => updateField("country", event.target.value)}
              />
            </div>
          </div>
          <div className="sm:col-span-2 flex items-center gap-2">
            <input
              id="me-marketing"
              type="checkbox"
              checked={form.marketingOptIn}
              onChange={(event) =>
                updateField("marketingOptIn", event.target.checked)
              }
            />
            <Label htmlFor="me-marketing">Marketing opt-in</Label>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button onClick={saveProfile} disabled={saving}>
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  )
}
