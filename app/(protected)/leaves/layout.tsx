import { redirect } from "next/navigation"

import { auth } from "@/auth"

export default async function LeavesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  const role = (session?.user as { role?: string })?.role

  if (!session?.user) {
    redirect("/auth/signin")
  }
  if (role !== "OWNER" && role !== "ADMIN" && role !== "MANAGER" && role !== "STAFF") {
    redirect("/dashboard")
  }

  return <>{children}</>
}
