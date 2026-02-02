import type { Role } from "@/lib/permissions"

export type InviteFormValues = {
  email: string
  role: Role
}

export const inviteRoleOptions: Role[] = ["ADMIN", "MANAGER", "STAFF", "CUSTOMER"]

export const defaultInviteFormValues: InviteFormValues = {
  email: "",
  role: "CUSTOMER",
}

