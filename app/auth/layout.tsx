import { notFound } from "next/navigation"

import { resolveTenantFromServerHeaders } from "@/lib/tenancy"

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const tenant = await resolveTenantFromServerHeaders()
  if (!tenant) {
    notFound()
  }
  return children
}

