import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { resolveTenantFromServerHeaders } from "@/lib/tenancy";

export default async function Home() {
  const session = await auth();
  if (session?.user) {
    const role = (session.user as { role?: string | null }).role ?? null
    const tenant = await resolveTenantFromServerHeaders()
    const platformTenantSlug =
      process.env.PLATFORM_ADMIN_TENANT_SLUG?.trim().toLowerCase() || "platform"
    if (
      role === "ADMIN" &&
      tenant?.slug === platformTenantSlug
    ) {
      redirect("/settings/tenants")
    }
    redirect("/dashboard");
  }
  redirect("/auth/signin");
}
