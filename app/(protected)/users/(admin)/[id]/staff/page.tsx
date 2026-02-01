"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { canManageUsers, type Role } from "@/lib/permissions"
import { toISODate } from "@/lib/date"

type ServiceOption = { id: string; name: string }

type StaffUser = {
  id: string
  name: string | null
  email: string
  role: Role
  eligibleServiceIds?: string[]
  staffProfile?: {
    certifications?: {
      id: string
      title: string
      issuer: string | null
      issuedAt: string | null
      expiresAt: string | null
    }[]
    documents?: {
      id: string
      type: "ADDRESS" | "ID" | "OTHER"
      number: string | null
      imageUrl: string
      validFrom: string | null
      validTo: string | null
    }[]
  } | null
}

type StaffProfileForm = {
  certifications: {
    id?: string
    title: string
    issuer: string
    issuedAt: string
    expiresAt: string
  }[]
  documents: {
    id?: string
    type: "ADDRESS" | "ID" | "OTHER"
    number: string
    imageUrl: string
    validFrom: string
    validTo: string
  }[]
}

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
  const [selectedIds, setSelectedIds] = React.useState<string[]>([])
  const [query, setQuery] = React.useState("")
  const [profile, setProfile] = React.useState<StaffProfileForm>({
    certifications: [],
    documents: [],
  })

  React.useEffect(() => {
    if (!params.id) return
    const load = async () => {
      setLoading(true)
      const [userRes, servicesRes] = await Promise.all([
        fetch(`/api/users/${params.id}`, { cache: "no-store" }),
        fetch("/api/services?page=1&pageSize=100&sort=name&order=asc&status=ACTIVE", {
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
      setProfile({
        certifications:
          userRecord?.staffProfile?.certifications?.map((cert) => ({
            id: cert.id,
            title: cert.title,
            issuer: cert.issuer ?? "",
            issuedAt: cert.issuedAt
              ? toISODate(cert.issuedAt)
              : "",
            expiresAt: cert.expiresAt
              ? toISODate(cert.expiresAt)
              : "",
          })) ?? [],
        documents:
          userRecord?.staffProfile?.documents?.map((doc) => ({
            id: doc.id,
            type: doc.type,
            number: doc.number ?? "",
            imageUrl: doc.imageUrl,
            validFrom: doc.validFrom
              ? toISODate(doc.validFrom)
              : "",
            validTo: doc.validTo
              ? toISODate(doc.validTo)
              : "",
          })) ?? [],
      })

      if (servicesRes.ok) {
        const data = (await servicesRes.json()) as {
          items?: { id: string; name: string }[]
        }
        setServiceOptions(data.items ?? [])
      } else {
        setServiceOptions([])
      }

      setLoading(false)
    }

    void load()
  }, [params.id])

  const toggleService = (serviceId: string, checked: boolean) => {
    setSelectedIds((prev) =>
      checked ? [...prev, serviceId] : prev.filter((id) => id !== serviceId)
    )
  }

  const save = async () => {
    if (!user) return
    setSaving(true)
    const response = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eligibleServiceIds: selectedIds,
        staffProfile: {
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

  const filtered = query.trim()
    ? serviceOptions.filter((option) =>
        option.name.toLowerCase().includes(query.trim().toLowerCase())
      )
    : serviceOptions

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
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6">
        <div className="space-y-2">
          <div className="text-sm font-medium">Eligible services</div>
          <p className="text-xs text-muted-foreground">
            Leave empty to allow all services for this staff member.
          </p>
        </div>
        <div className="mt-4 space-y-3">
          <Input
            placeholder="Search services..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="max-h-80 space-y-2 overflow-y-auto rounded-md border border-input bg-background p-3 text-sm">
            {filtered.length ? (
              filtered.map((option) => (
                <label key={option.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(option.id)}
                    onChange={(event) => toggleService(option.id, event.target.checked)}
                  />
                  <span>{option.name}</span>
                </label>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">No services found.</p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Documents</h2>
            <p className="text-sm text-muted-foreground">
              Add document links with type, number, and validity dates.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() =>
              setProfile((prev) => ({
                ...prev,
                documents: [
                  ...prev.documents,
                  { type: "ID", number: "", imageUrl: "", validFrom: "", validTo: "" },
                ],
              }))
            }
          >
            Add document
          </Button>
        </div>

        {profile.documents.length ? (
          <div className="mt-4 space-y-3">
            {profile.documents.map((doc, index) => (
              <div
                key={`${doc.type}-${index}`}
                className="grid gap-3 sm:grid-cols-[140px_1fr_1fr_1fr_1fr_auto] sm:items-end"
              >
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Type</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={doc.type}
                    onChange={(event) =>
                      setProfile((prev) => ({
                        ...prev,
                        documents: prev.documents.map((item, idx) =>
                          idx === index
                            ? {
                                ...item,
                                type: event.target.value as StaffProfileForm["documents"][number]["type"],
                              }
                            : item
                        ),
                      }))
                    }
                  >
                    <option value="ID">ID</option>
                    <option value="ADDRESS">Address</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Number</Label>
                  <Input
                    placeholder="Document number"
                    value={doc.number}
                    onChange={(event) =>
                      setProfile((prev) => ({
                        ...prev,
                        documents: prev.documents.map((item, idx) =>
                          idx === index ? { ...item, number: event.target.value } : item
                        ),
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Link</Label>
                  <Input
                    placeholder="Image URL"
                    value={doc.imageUrl}
                    onChange={(event) =>
                      setProfile((prev) => ({
                        ...prev,
                        documents: prev.documents.map((item, idx) =>
                          idx === index ? { ...item, imageUrl: event.target.value } : item
                        ),
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Valid from</Label>
                  <Input
                    type="date"
                    value={doc.validFrom}
                    onChange={(event) =>
                      setProfile((prev) => ({
                        ...prev,
                        documents: prev.documents.map((item, idx) =>
                          idx === index ? { ...item, validFrom: event.target.value } : item
                        ),
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Valid to</Label>
                  <Input
                    type="date"
                    value={doc.validTo}
                    onChange={(event) =>
                      setProfile((prev) => ({
                        ...prev,
                        documents: prev.documents.map((item, idx) =>
                          idx === index ? { ...item, validTo: event.target.value } : item
                        ),
                      }))
                    }
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={() =>
                    setProfile((prev) => ({
                      ...prev,
                      documents: prev.documents.filter((_, idx) => idx !== index),
                    }))
                  }
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            No documents added yet.
          </p>
        )}
      </div>

      <div className="rounded-xl border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Certifications</h2>
            <p className="text-sm text-muted-foreground">
              Track staff certifications with issue and expiry dates.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() =>
              setProfile((prev) => ({
                ...prev,
                certifications: [
                  ...prev.certifications,
                  { title: "", issuer: "", issuedAt: "", expiresAt: "" },
                ],
              }))
            }
          >
            Add certification
          </Button>
        </div>

        {profile.certifications.length ? (
          <div className="mt-4 space-y-3">
            {profile.certifications.map((cert, index) => (
              <div
                key={`${cert.title}-${index}`}
                className="grid gap-3 sm:grid-cols-[1.5fr_1fr_1fr_1fr_auto] sm:items-end"
              >
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Certification</Label>
                  <Input
                    placeholder="Certification"
                    value={cert.title}
                    onChange={(event) =>
                      setProfile((prev) => ({
                        ...prev,
                        certifications: prev.certifications.map((item, idx) =>
                          idx === index ? { ...item, title: event.target.value } : item
                        ),
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Issuer</Label>
                  <Input
                    placeholder="Issuer"
                    value={cert.issuer}
                    onChange={(event) =>
                      setProfile((prev) => ({
                        ...prev,
                        certifications: prev.certifications.map((item, idx) =>
                          idx === index ? { ...item, issuer: event.target.value } : item
                        ),
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Issue date</Label>
                  <Input
                    type="date"
                    value={cert.issuedAt}
                    onChange={(event) =>
                      setProfile((prev) => ({
                        ...prev,
                        certifications: prev.certifications.map((item, idx) =>
                          idx === index ? { ...item, issuedAt: event.target.value } : item
                        ),
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Expiry date</Label>
                  <Input
                    type="date"
                    value={cert.expiresAt}
                    onChange={(event) =>
                      setProfile((prev) => ({
                        ...prev,
                        certifications: prev.certifications.map((item, idx) =>
                          idx === index ? { ...item, expiresAt: event.target.value } : item
                        ),
                      }))
                    }
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={() =>
                    setProfile((prev) => ({
                      ...prev,
                      certifications: prev.certifications.filter((_, idx) => idx !== index),
                    }))
                  }
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            No certifications added yet.
          </p>
        )}
      </div>
    </div>
  )
}
