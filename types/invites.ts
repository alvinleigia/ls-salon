import type { Role } from "@/lib/permissions"

export type InviteRow = {
  id: string
  email: string
  role: Role
  token: string
  createdAt: string
  expiresAt: string
  acceptedAt: string | null
}

export type InviteStatusFilter = "all" | "pending" | "accepted" | "expired"
