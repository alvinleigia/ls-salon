"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { canManageUsers, type Role } from "@/lib/permissions"

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
    rosterOverrides?: {
      id: string
      date: string
      isOpen: boolean
      periods: {
        id: string
        kind: "WORK" | "BREAK"
        startTime: string
        endTime: string
        sortOrder: number
      }[]
    }[]
    weeklyOverrides?: {
      id: string
      day: "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY"
      isOpen: boolean
      periods: {
        id: string
        kind: "WORK" | "BREAK"
        startTime: string
        endTime: string
        sortOrder: number
      }[]
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
  rosterOverrides: {
    id?: string
    date: string
    isOpen: boolean
    periods: {
      id?: string
      kind: "WORK" | "BREAK"
      startTime: string
      endTime: string
      sortOrder?: number
    }[]
  }[]
  weeklyOverrides: {
    id?: string
    day: "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY"
    isOpen: boolean
    periods: {
      id?: string
      kind: "WORK" | "BREAK"
      startTime: string
      endTime: string
      sortOrder?: number
    }[]
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
    rosterOverrides: [],
    weeklyOverrides: [],
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
              ? new Date(cert.issuedAt).toISOString().slice(0, 10)
              : "",
            expiresAt: cert.expiresAt
              ? new Date(cert.expiresAt).toISOString().slice(0, 10)
              : "",
          })) ?? [],
        documents:
          userRecord?.staffProfile?.documents?.map((doc) => ({
            id: doc.id,
            type: doc.type,
            number: doc.number ?? "",
            imageUrl: doc.imageUrl,
            validFrom: doc.validFrom
              ? new Date(doc.validFrom).toISOString().slice(0, 10)
              : "",
            validTo: doc.validTo
              ? new Date(doc.validTo).toISOString().slice(0, 10)
              : "",
          })) ?? [],
        rosterOverrides:
          userRecord?.staffProfile?.rosterOverrides?.map((override) => ({
            id: override.id,
            date: new Date(override.date).toISOString().slice(0, 10),
            isOpen: override.isOpen,
            periods: override.periods.map((period) => ({
              id: period.id,
              kind: period.kind,
              startTime: period.startTime,
              endTime: period.endTime,
              sortOrder: period.sortOrder,
            })),
          })) ?? [],
        weeklyOverrides:
          userRecord?.staffProfile?.weeklyOverrides?.map((override) => ({
            id: override.id,
            day: override.day,
            isOpen: override.isOpen,
            periods: override.periods.map((period) => ({
              id: period.id,
              kind: period.kind,
              startTime: period.startTime,
              endTime: period.endTime,
              sortOrder: period.sortOrder,
            })),
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
          rosterOverrides: profile.rosterOverrides.map((override) => ({
            id: override.id,
            date: override.date,
            isOpen: override.isOpen,
            periods: override.periods.map((period) => ({
              id: period.id,
              kind: period.kind,
              startTime: period.startTime,
              endTime: period.endTime,
              sortOrder: period.sortOrder,
            })),
          })),
          weeklyOverrides: profile.weeklyOverrides.map((override) => ({
            id: override.id,
            day: override.day,
            isOpen: override.isOpen,
            periods: override.periods.map((period) => ({
              id: period.id,
              kind: period.kind,
              startTime: period.startTime,
              endTime: period.endTime,
              sortOrder: period.sortOrder,
            })),
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

    toast.success("Staff eligibility updated.")
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
            <h2 className="text-lg font-semibold">Roster overrides</h2>
            <p className="text-sm text-muted-foreground">
              Inherits global hours. Add date overrides for this staff member.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              const today = new Date().toISOString().slice(0, 10)
              if (profile.rosterOverrides.some((override) => override.date === today)) {
                toast.error("An override for today already exists.")
                return
              }
              setProfile((prev) => ({
                ...prev,
                rosterOverrides: [
                  ...prev.rosterOverrides,
                  {
                    date: today,
                    isOpen: true,
                    periods: [{ kind: "WORK", startTime: "09:00", endTime: "18:00" }],
                  },
                ],
              }))
            }}
          >
            Add override
          </Button>
        </div>

        {profile.rosterOverrides.length ? (
          <div className="mt-4 space-y-4">
            {profile.rosterOverrides.map((override, overrideIndex) => (
              <div key={`${override.date}-${overrideIndex}`} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Date</Label>
                    <Input
                      type="date"
                      value={override.date}
                      onChange={(event) => {
                        const nextDate = event.target.value
                        if (
                          profile.rosterOverrides.some(
                            (item, index) =>
                              index !== overrideIndex && item.date === nextDate
                          )
                        ) {
                          toast.error("That date already has an override.")
                          return
                        }
                        setProfile((prev) => ({
                          ...prev,
                          rosterOverrides: prev.rosterOverrides.map((item, idx) =>
                            idx === overrideIndex ? { ...item, date: nextDate } : item
                          ),
                        }))
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={override.isOpen}
                        onChange={(event) =>
                          setProfile((prev) => ({
                            ...prev,
                            rosterOverrides: prev.rosterOverrides.map((item, idx) =>
                              idx === overrideIndex
                                ? {
                                    ...item,
                                    isOpen: event.target.checked,
                                    periods: event.target.checked
                                      ? item.periods.length
                                        ? item.periods
                                        : [{ kind: "WORK", startTime: "09:00", endTime: "18:00" }]
                                      : [],
                                  }
                                : item
                            ),
                          }))
                        }
                      />
                      Open
                    </label>
                    <Button
                      variant="outline"
                      onClick={() =>
                        setProfile((prev) => ({
                          ...prev,
                          rosterOverrides: prev.rosterOverrides.filter((_, idx) => idx !== overrideIndex),
                        }))
                      }
                    >
                      Remove
                    </Button>
                  </div>
                </div>

                {override.isOpen ? (
                  <div className="mt-4 space-y-3">
                    {override.periods.map((period, periodIndex) => (
                      <div
                        key={`${override.date}-${periodIndex}`}
                        className="grid gap-3 sm:grid-cols-[140px_1fr_1fr_auto] sm:items-end"
                      >
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Type</Label>
                          <select
                            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                            value={period.kind}
                            onChange={(event) =>
                              setProfile((prev) => ({
                                ...prev,
                                rosterOverrides: prev.rosterOverrides.map((item, idx) =>
                                  idx === overrideIndex
                                    ? {
                                        ...item,
                                        periods: item.periods.map((p, pIdx) =>
                                          pIdx === periodIndex
                                            ? {
                                                ...p,
                                                kind: event.target.value as StaffProfileForm["rosterOverrides"][number]["periods"][number]["kind"],
                                              }
                                            : p
                                        ),
                                      }
                                    : item
                                ),
                              }))
                            }
                          >
                            <option value="WORK">Work</option>
                            <option value="BREAK">Break</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Start</Label>
                          <Input
                            type="time"
                            value={period.startTime}
                            onChange={(event) =>
                              setProfile((prev) => ({
                                ...prev,
                                rosterOverrides: prev.rosterOverrides.map((item, idx) =>
                                  idx === overrideIndex
                                    ? {
                                        ...item,
                                        periods: item.periods.map((p, pIdx) =>
                                          pIdx === periodIndex
                                            ? { ...p, startTime: event.target.value }
                                            : p
                                        ),
                                      }
                                    : item
                                ),
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">End</Label>
                          <Input
                            type="time"
                            value={period.endTime}
                            onChange={(event) =>
                              setProfile((prev) => ({
                                ...prev,
                                rosterOverrides: prev.rosterOverrides.map((item, idx) =>
                                  idx === overrideIndex
                                    ? {
                                        ...item,
                                        periods: item.periods.map((p, pIdx) =>
                                          pIdx === periodIndex
                                            ? { ...p, endTime: event.target.value }
                                            : p
                                        ),
                                      }
                                    : item
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
                              rosterOverrides: prev.rosterOverrides.map((item, idx) =>
                                idx === overrideIndex
                                  ? {
                                      ...item,
                                      periods: item.periods.filter((_, pIdx) => pIdx !== periodIndex),
                                    }
                                  : item
                              ),
                            }))
                          }
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        onClick={() =>
                          setProfile((prev) => ({
                            ...prev,
                            rosterOverrides: prev.rosterOverrides.map((item, idx) =>
                              idx === overrideIndex
                                ? {
                                    ...item,
                                    periods: [
                                      ...item.periods,
                                      { kind: "WORK", startTime: "09:00", endTime: "18:00" },
                                    ],
                                  }
                                : item
                            ),
                          }))
                        }
                      >
                        Add work period
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() =>
                          setProfile((prev) => ({
                            ...prev,
                            rosterOverrides: prev.rosterOverrides.map((item, idx) =>
                              idx === overrideIndex
                                ? {
                                    ...item,
                                    periods: [
                                      ...item.periods,
                                      { kind: "BREAK", startTime: "12:00", endTime: "13:00" },
                                    ],
                                  }
                                : item
                            ),
                          }))
                        }
                      >
                        Add break
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Closed for this day.
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            No overrides yet.
          </p>
        )}
      </div>

      <div className="rounded-xl border bg-card p-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Weekly availability</h2>
          <p className="text-sm text-muted-foreground">
            Override weekly hours for this staff member (leave empty to inherit).
          </p>
        </div>

        <div className="mt-4 space-y-4">
          {(["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"] as const).map(
            (day) => {
              const overrideIndex = profile.weeklyOverrides.findIndex((item) => item.day === day)
              const override =
                overrideIndex >= 0
                  ? profile.weeklyOverrides[overrideIndex]
                  : null
              return (
                <div key={day} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm font-medium">
                      {day.charAt(0) + day.slice(1).toLowerCase()}
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={override?.isOpen ?? false}
                          onChange={(event) => {
                            if (overrideIndex === -1) {
                              setProfile((prev) => ({
                                ...prev,
                                weeklyOverrides: [
                                  ...prev.weeklyOverrides,
                                  {
                                    day,
                                    isOpen: event.target.checked,
                                    periods: event.target.checked
                                      ? [{ kind: "WORK", startTime: "09:00", endTime: "18:00" }]
                                      : [],
                                  },
                                ],
                              }))
                              return
                            }
                            setProfile((prev) => ({
                              ...prev,
                              weeklyOverrides: prev.weeklyOverrides.map((item, idx) =>
                                idx === overrideIndex
                                  ? {
                                      ...item,
                                      isOpen: event.target.checked,
                                      periods: event.target.checked
                                        ? item.periods.length
                                          ? item.periods
                                          : [{ kind: "WORK", startTime: "09:00", endTime: "18:00" }]
                                        : [],
                                    }
                                  : item
                              ),
                            }))
                          }}
                        />
                        Override
                      </label>
                      {override ? (
                        <Button
                          variant="outline"
                          onClick={() =>
                            setProfile((prev) => ({
                              ...prev,
                              weeklyOverrides: prev.weeklyOverrides.filter((item) => item.day !== day),
                            }))
                          }
                        >
                          Clear
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  {override && override.isOpen ? (
                    <div className="mt-4 space-y-3">
                      {override.periods.map((period, periodIndex) => (
                        <div
                          key={`${day}-${periodIndex}`}
                          className="grid gap-3 sm:grid-cols-[140px_1fr_1fr_auto] sm:items-end"
                        >
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Type</Label>
                            <select
                              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                              value={period.kind}
                              onChange={(event) =>
                                setProfile((prev) => ({
                                  ...prev,
                                  weeklyOverrides: prev.weeklyOverrides.map((item, idx) =>
                                    idx === overrideIndex
                                      ? {
                                          ...item,
                                          periods: item.periods.map((p, pIdx) =>
                                            pIdx === periodIndex
                                              ? {
                                                  ...p,
                                                  kind: event.target.value as StaffProfileForm["weeklyOverrides"][number]["periods"][number]["kind"],
                                                }
                                              : p
                                          ),
                                        }
                                      : item
                                  ),
                                }))
                              }
                            >
                              <option value="WORK">Work</option>
                              <option value="BREAK">Break</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Start</Label>
                            <Input
                              type="time"
                              value={period.startTime}
                              onChange={(event) =>
                                setProfile((prev) => ({
                                  ...prev,
                                  weeklyOverrides: prev.weeklyOverrides.map((item, idx) =>
                                    idx === overrideIndex
                                      ? {
                                          ...item,
                                          periods: item.periods.map((p, pIdx) =>
                                            pIdx === periodIndex
                                              ? { ...p, startTime: event.target.value }
                                              : p
                                          ),
                                        }
                                      : item
                                  ),
                                }))
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">End</Label>
                            <Input
                              type="time"
                              value={period.endTime}
                              onChange={(event) =>
                                setProfile((prev) => ({
                                  ...prev,
                                  weeklyOverrides: prev.weeklyOverrides.map((item, idx) =>
                                    idx === overrideIndex
                                      ? {
                                          ...item,
                                          periods: item.periods.map((p, pIdx) =>
                                            pIdx === periodIndex
                                              ? { ...p, endTime: event.target.value }
                                              : p
                                          ),
                                        }
                                      : item
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
                                weeklyOverrides: prev.weeklyOverrides.map((item, idx) =>
                                  idx === overrideIndex
                                    ? {
                                        ...item,
                                        periods: item.periods.filter((_, pIdx) => pIdx !== periodIndex),
                                      }
                                    : item
                                ),
                              }))
                            }
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          onClick={() =>
                            setProfile((prev) => ({
                              ...prev,
                              weeklyOverrides: prev.weeklyOverrides.map((item, idx) =>
                                idx === overrideIndex
                                  ? {
                                      ...item,
                                      periods: [
                                        ...item.periods,
                                        { kind: "WORK", startTime: "09:00", endTime: "18:00" },
                                      ],
                                    }
                                  : item
                              ),
                            }))
                          }
                        >
                          Add work period
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() =>
                            setProfile((prev) => ({
                              ...prev,
                              weeklyOverrides: prev.weeklyOverrides.map((item, idx) =>
                                idx === overrideIndex
                                  ? {
                                      ...item,
                                      periods: [
                                        ...item.periods,
                                        { kind: "BREAK", startTime: "12:00", endTime: "13:00" },
                                      ],
                                    }
                                  : item
                              ),
                            }))
                          }
                        >
                          Add break
                        </Button>
                      </div>
                    </div>
                  ) : override ? (
                    <p className="mt-3 text-sm text-muted-foreground">
                      Closed for this day.
                    </p>
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground">
                      Inherits global hours.
                    </p>
                  )}
                </div>
              )
            }
          )}
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
