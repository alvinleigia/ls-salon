import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { resolveTenantFromServerHeaders } from "@/lib/tenancy";

export default async function Home() {
  const session = await auth();
  if (session?.user) {
    const role = (session.user as { role?: string | null }).role ?? null
    const platformAccessMode =
      (session.user as {
        platformAccessMode?: "SUPER_ADMIN" | "ORG_MEMBER" | null
      }).platformAccessMode ?? null
    const tenant = await resolveTenantFromServerHeaders()
    const platformTenantSlug =
      process.env.PLATFORM_ADMIN_TENANT_SLUG?.trim().toLowerCase() || "platform"
    if (
      tenant?.slug === platformTenantSlug &&
      (platformAccessMode === "SUPER_ADMIN" || platformAccessMode === "ORG_MEMBER")
    ) {
      redirect("/settings/organizations")
    }
    redirect("/dashboard");
  }
  redirect("/auth/signin");
}
