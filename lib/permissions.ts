export type Role = "OWNER" | "ADMIN" | "MANAGER" | "STAFF" | "CUSTOMER"

export function canManageUsers(role?: Role | null) {
  return role === "OWNER" || role === "ADMIN" || role === "MANAGER"
}

export function canInvite(role?: Role | null) {
  return role === "OWNER" || role === "ADMIN"
}

export function canManageTenants(role?: Role | null) {
  return role === "OWNER" || role === "ADMIN"
}
