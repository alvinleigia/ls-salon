"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { canManageUsers, type Role } from "@/lib/permissions"
import type { ServiceOption } from "@/types/services"
import type { StaffProfileForm, StaffUser } from "@/types/users"
import { StaffFormFields } from "./staff-form-fields"
import { emptyStaffProfileForm, toStaffProfileForm } from "./staff-form-model"

export default function StaffProfilePage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const { data: session } = useSession()
  const currentRole = (session?.user as { role?: Role })?.role
  const canManage = canManageUsers(currentRole as Role)

  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [user, setUser] = React.useState<StaffUser | null>(null)
  const [serviceOptions, setServiceOptions] = React.useState<ServiceOption[]>([])
  const [managerOptions, setManagerOptions] = React.useState<Array<{ value: string; label: string }>>([])
  const [selectedIds, setSelectedIds] = React.useState<string[]>([])
  const [query, setQuery] = React.useState("")
  const [profile, setProfile] = React.useState<StaffProfileForm>(emptyStaffProfileForm)

  React.useEffect(() => {
    if (!params.id) return

    const load = async () => {
      setLoading(true)
      const [userRes, servicesRes, managersRes] = await Promise.all([
        fetch(`/api/users/${params.id}`, { cache: "no-store" }),
        fetch("/api/services?page=1&pageSize=100&sort=name&order=asc&status=ACTIVE", {
          cache: "no-store",
        }),
        fetch("/api/users?page=1&pageSize=100&sort=name&order=asc&role=MANAGER&status=ACTIVE", {
          cache: "no-store",
        }),
      ])

      if (!userRes.ok) {
        toast.error("Unable to load staff profile.")
        setLoading(false)
        return
      }

      const userData = (await userRes.json()) as { user?: StaffUser }
      const userRecord = userData.user ?? null
      setUser(userRecord)
      setSelectedIds(userRecord?.eligibleServiceIds ?? [])
      setProfile(toStaffProfileForm(userRecord))

      if (servicesRes.ok) {
        const data = (await servicesRes.json()) as {
          items?: { id: string; name: string }[]
        }
        setServiceOptions(data.items ?? [])
      } else {
        setServiceOptions([])
      }

      if (managersRes.ok) {
        const data = (await managersRes.json()) as {
          items?: { id: string; name: string | null; email: string }[]
        }
        setManagerOptions([
          { value: "", label: "No manager assigned" },
          ...(data.items ?? []).map((manager) => ({
            value: manager.id,
            label: manager.name?.trim() || manager.email,
          })),
        ])
      } else {
        setManagerOptions([{ value: "", label: "No manager assigned" }])
      }

      setLoading(false)
    }

    void load()
  }, [params.id])

  const save = async () => {
    if (!user) return
    setSaving(true)

    const response = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eligibleServiceIds: selectedIds,
        staffProfile: {
          managerUserId: profile.managerUserId,
          documents: profile.documents.map((doc) => ({
            id: doc.id,
            type: doc.type,
            number: doc.number,
            imageUrl: doc.imageUrl,
            validFrom: doc.validFrom,
            validTo: doc.validTo,
          })),
          certifications: profile.certifications.map((cert) => ({
            id: cert.id,
            title: cert.title,
            issuer: cert.issuer,
            issuedAt: cert.issuedAt,
            expiresAt: cert.expiresAt,
          })),
        },
      }),
    })

    if (!response.ok) {
      const data = (await response.json()) as { error?: string }
      toast.error(data.error ?? "Unable to update staff eligibility.")
      setSaving(false)
      return
    }

    toast.success("Staff profile updated.")
    setSaving(false)
  }

  if (!canManage) {
    return (
      <div className="text-sm text-muted-foreground">
        You do not have access to this page.
      </div>
    )
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading staff...</div>
  }

  if (!user) {
    return <div className="text-sm text-muted-foreground">Staff not found.</div>
  }

  if (user.role !== "STAFF") {
    return (
      <div className="space-y-3">
        <div className="text-sm text-muted-foreground">
          This user is not a staff member.
        </div>
        <Button variant="outline" onClick={() => router.push(`/users/${user.id}`)}>
          Back to profile
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Staff eligibility</h1>
          <p className="text-sm text-muted-foreground">
            {user.name ?? "Staff"} - {user.email}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => router.push(`/users/${user.id}`)}>
            Back to profile
          </Button>
          <Button onClick={save} loading={saving} loadingText="Saving...">
            Save
          </Button>
        </div>
      </div>

      <StaffFormFields
        profile={profile}
        setProfile={setProfile}
        serviceOptions={serviceOptions}
        selectedIds={selectedIds}
        setSelectedIds={setSelectedIds}
        managerOptions={managerOptions}
        query={query}
        setQuery={setQuery}
      />
    </div>
  )
}
