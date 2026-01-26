"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { canManageUsers, type Role } from "@/lib/permissions"

type Gender = "MALE" | "FEMALE" | "NON_BINARY" | "OTHER" | "PREFER_NOT_TO_SAY"
type UserStatus = "ACTIVE" | "SUSPENDED" | "INVITED" | "ARCHIVED"

type UserProfile = {
  id: string
  name: string | null
  email: string
  phone: string | null
  image: string | null
  role: Role
  status: UserStatus
  gender: Gender | null
  dateOfBirth: string | null
  marketingOptIn: boolean
  addressLine1: string | null
  addressLine2: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  country: string | null
  createdAt: string
  updatedAt: string
}

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString() : "-"

export default function UserProfilePage() {
  const router = useRouter()
  const { data: session } = useSession()
  const currentRole = (session?.user as { role?: Role })?.role
  const canManage = canManageUsers(currentRole as Role)
  const params = useParams<{ id: string }>()
  const [user, setUser] = React.useState<UserProfile | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const load = async () => {
      setLoading(true)
      const response = await fetch(`/api/users/${params.id}`)
      if (!response.ok) {
        toast.error("Unable to load user profile.")
        setLoading(false)
        return
      }
      const data = (await response.json()) as { user: UserProfile }
      setUser(data.user)
      setLoading(false)
    }
    void load()
  }, [params.id])

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading profile...</div>
  }

  if (!user) {
    return <div className="text-sm text-muted-foreground">User not found.</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{user.name ?? "User"}</h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canManage && user.role === "STAFF" ? (
            <Button onClick={() => router.push(`/users/${user.id}/staff`)}>
              Staff profile
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => router.push("/users")}>
            Back to users
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="text-xs text-muted-foreground">Role</div>
                <div className="font-medium">{user.role}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Status</div>
                <div className="font-medium">{user.status}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Phone</div>
                <div className="font-medium">{user.phone ?? "-"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Date of birth</div>
                <div className="font-medium">{formatDate(user.dateOfBirth)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Gender</div>
                <div className="font-medium">
                  {user.gender ? user.gender.replaceAll("_", " ") : "-"}
                </div>
              </div>
              {user.role !== "STAFF" ? (
                <div>
                  <div className="text-xs text-muted-foreground">Marketing opt-in</div>
                  <div className="font-medium">
                    {user.marketingOptIn ? "Yes" : "No"}
                  </div>
                </div>
              ) : null}
              <div>
                <div className="text-xs text-muted-foreground">Created</div>
                <div className="font-medium">{formatDate(user.createdAt)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Updated</div>
                <div className="font-medium">{formatDate(user.updatedAt)}</div>
              </div>
            </div>

            <div>
              <div className="text-xs text-muted-foreground">Address</div>
              <div className="font-medium">
                {user.addressLine1 || user.addressLine2 || user.city ? (
                  <div className="space-y-1">
                    <div>{user.addressLine1 ?? "-"}</div>
                    {user.addressLine2 ? <div>{user.addressLine2}</div> : null}
                    <div>
                      {[user.city, user.state, user.postalCode]
                        .filter(Boolean)
                        .join(", ") || "-"}
                    </div>
                    <div>{user.country ?? "-"}</div>
                  </div>
                ) : (
                  "-"
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Avatar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 overflow-hidden rounded-full border bg-muted">
                {user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.image}
                    alt={user.name ?? "User"}
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
              <div className="text-sm text-muted-foreground">
                {user.image ? "Profile image set" : "No image uploaded"}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
