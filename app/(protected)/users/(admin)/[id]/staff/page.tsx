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

type Weekday =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY"

const WEEKDAYS: { value: Weekday; label: string }[] = [
  { value: "MONDAY", label: "Monday" },
  { value: "TUESDAY", label: "Tuesday" },
  { value: "WEDNESDAY", label: "Wednesday" },
  { value: "THURSDAY", label: "Thursday" },
  { value: "FRIDAY", label: "Friday" },
  { value: "SATURDAY", label: "Saturday" },
  { value: "SUNDAY", label: "Sunday" },
]

type ShiftTemplateBreak = {
  id?: string
  startTime: string
  endTime: string
  sortOrder?: number
}

type ShiftTemplate = {
  id: string
  name: string
  description?: string | null
  color?: string | null
  isActive: boolean
  startTime: string
  endTime: string
  breaks: ShiftTemplateBreak[]
}

type StaffShiftAssignment = {
  id?: string
  day: Weekday
  templateId: string
  template?: { id: string; name: string; color?: string | null }
}

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
    shiftAssignments?: StaffShiftAssignment[]
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
  shiftAssignments: {
    day: Weekday
    templateId: string
  }[]
}

const normalizeAssignments = (
  assignments?: StaffShiftAssignment[]
): StaffProfileForm["shiftAssignments"] => {
  return WEEKDAYS.map((day) => {
    const match = assignments?.find((assignment) => assignment.day === day.value)
    return {
      day: day.value,
      templateId: match?.templateId ?? "",
    }
  })
}

const summarizeTemplate = (template?: ShiftTemplate) => {
  if (!template) return ""
  const breaks =
    template.breaks?.length > 0
      ? template.breaks.map((period) => `${period.startTime}-${period.endTime}`).join(" - ")
      : "No breaks"
  return `Shift ${template.startTime}-${template.endTime} - ${breaks}`
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
  const [templates, setTemplates] = React.useState<ShiftTemplate[]>([])
  const [templatesLoading, setTemplatesLoading] = React.useState(true)
  const [profile, setProfile] = React.useState<StaffProfileForm>({
    certifications: [],
    documents: [],
    shiftAssignments: normalizeAssignments(),
  })

  const templateMap = React.useMemo(() => {
    return new Map(templates.map((template) => [template.id, template]))
  }, [templates])

  React.useEffect(() => {
    if (!params.id) return
    const load = async () => {
      setLoading(true)
      const [userRes, servicesRes, templatesRes] = await Promise.all([
        fetch(`/api/users/${params.id}`, { cache: "no-store" }),
        fetch("/api/services?page=1&pageSize=100&sort=name&order=asc&status=ACTIVE", {
          cache: "no-store",
        }),
        fetch("/api/shifts/templates?includeInactive=true", { cache: "no-store" }),
      ])

      if (!userRes.ok) {
        toast.error("Unable to load staff profile.")
        setTemplatesLoading(false)
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
        shiftAssignments: normalizeAssignments(userRecord?.staffProfile?.shiftAssignments),
      })

      if (servicesRes.ok) {
        const data = (await servicesRes.json()) as {
          items?: { id: string; name: string }[]
        }
        setServiceOptions(data.items ?? [])
      } else {
        setServiceOptions([])
      }

      if (templatesRes.ok) {
        const data = (await templatesRes.json()) as { items?: ShiftTemplate[] }
        setTemplates(data.items ?? [])
      } else {
        setTemplates([])
      }
      setTemplatesLoading(false)
      setLoading(false)
    }

    void load()
  }, [params.id])

  const toggleService = (serviceId: string, checked: boolean) => {
    setSelectedIds((prev) =>
      checked ? [...prev, serviceId] : prev.filter((id) => id !== serviceId)
    )
  }

  const updateAssignment = (day: Weekday, templateId: string) => {
    setProfile((prev) => ({
      ...prev,
      shiftAssignments: prev.shiftAssignments.map((assignment) =>
        assignment.day === day ? { ...assignment, templateId } : assignment
      ),
    }))
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
          shiftAssignments: profile.shiftAssignments
            .filter((assignment) => assignment.templateId)
            .map((assignment) => ({
              day: assignment.day,
              templateId: assignment.templateId,
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
        <div className="space-y-2">
          <div className="text-lg font-semibold">Shift assignments</div>
          <p className="text-sm text-muted-foreground">
            Assign a shift template to each weekday. Leave empty to use global hours.
          </p>
        </div>
        {templatesLoading ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading templates...</p>
        ) : templates.length ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {profile.shiftAssignments.map((assignment) => {
              const template = assignment.templateId
                ? templateMap.get(assignment.templateId)
                : undefined
              return (
                <div key={assignment.day} className="rounded-lg border p-4">
                  <div className="text-sm font-medium">
                    {WEEKDAYS.find((day) => day.value === assignment.day)?.label}
                  </div>
                  <div className="mt-2 space-y-2">
                    <select
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={assignment.templateId}
                      onChange={(event) =>
                        updateAssignment(assignment.day, event.target.value)
                      }
                    >
                      <option value="">Use global hours</option>
                      {templates.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                          {item.isActive ? "" : " (inactive)"}
                        </option>
                      ))}
                    </select>
                    {template ? (
                      <div className="rounded-md border border-dashed p-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: template.color ?? "#64748b" }}
                          />
                          {template.name}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {summarizeTemplate(template)}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        No template assigned.
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            No shift templates available. Create one in Settings to assign shifts.
          </p>
        )}
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
