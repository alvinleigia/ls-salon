import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { canManageTenants, type Role } from "@/lib/permissions"
import { resolveTenantFromServerHeaders } from "@/lib/tenancy"

import TenantsPageClient from "./tenants-page-client"

const PLATFORM_TENANT_SLUG = (
  process.env.PLATFORM_ADMIN_TENANT_SLUG?.trim().toLowerCase() || "platform"
)

export default async function SettingsTenantsPage() {
  const session = await auth()
  const role = (session?.user as { role?: string })?.role

  if (!session?.user) {
    redirect("/auth/signin")
  }
  if (!canManageTenants(role as Role)) {
    redirect("/dashboard")
  }

  const tenant = await resolveTenantFromServerHeaders()
  if (!tenant || tenant.slug !== PLATFORM_TENANT_SLUG) {
    redirect("/dashboard")
  }

  return <TenantsPageClient />
}
