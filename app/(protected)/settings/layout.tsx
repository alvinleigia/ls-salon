import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { canManageUsers, type Role } from "@/lib/permissions"
import { getPlatformConsoleAccessFromSession } from "@/lib/platform-console"
import { resolveTenantFromServerHeaders } from "@/lib/tenancy"

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [session, tenant] = await Promise.all([auth(), resolveTenantFromServerHeaders()])
  const role = (session?.user as { role?: string })?.role

  if (!session?.user) {
    redirect("/auth/signin")
  }

  if (tenant?.slug === (process.env.PLATFORM_ADMIN_TENANT_SLUG?.trim().toLowerCase() || "platform")) {
    const platformAccess = await getPlatformConsoleAccessFromSession(session)
    if (platformAccess) {
      return <>{children}</>
    }
  }

  if (!canManageUsers(role as Role)) {
    redirect("/dashboard")
  }

  return <>{children}</>
}
