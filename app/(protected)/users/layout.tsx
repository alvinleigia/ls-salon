import { redirect } from "next/navigation"

import { auth } from "@/auth"

export default async function UsersLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session?.user) {
    redirect("/auth/signin")
  }

  return <>{children}</>
}
