import "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id?: string
      tenantId?: string
      tenantSlug?: string
      role?: "ADMIN" | "MANAGER" | "STAFF" | "CUSTOMER"
      name?: string | null
      email?: string | null
      image?: string | null
    }
  }

  interface User {
    tenantId?: string
    tenantSlug?: string
    role?: "ADMIN" | "MANAGER" | "STAFF" | "CUSTOMER"
  }
}
