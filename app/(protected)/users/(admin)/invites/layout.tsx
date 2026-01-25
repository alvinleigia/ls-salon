import { redirect } from "next/navigation"

import { auth } from "@/auth"
import { canInvite, type Role } from "@/lib/permissions"

export default async function InvitesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  const role = (session?.user as { role?: string })?.role

  if (!session?.user) {
    redirect("/auth/signin")
  }

  if (!canInvite(role as Role)) {
    redirect("/dashboard")
  }

  return <>{children}</>
}
