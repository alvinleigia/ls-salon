import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { getPlatformConsoleAccessFromSession } from "@/lib/platform-console"

import OrganizationsPageClient from "./organizations-page-client"

export default async function SettingsOrganizationsPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/auth/signin")
  }

  const platformAccess = await getPlatformConsoleAccessFromSession(session)
  if (!platformAccess) {
    redirect("/dashboard")
  }

  return (
    <OrganizationsPageClient
      platformAccessMode={platformAccess.mode}
      organizationRolesById={platformAccess.organizationRolesById}
    />
  )
}
