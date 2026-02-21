import { NextResponse } from "next/server"

import { auth } from "@/auth"

const PLATFORM_TENANT_SLUG = (
  process.env.PLATFORM_ADMIN_TENANT_SLUG?.trim().toLowerCase() || "default"
)

const getTenantSlugFromHost = (hostHeader: string | null) => {
  if (!hostHeader) return null
  const hostname = hostHeader.split(":")[0]?.trim().toLowerCase()
  if (!hostname) return null

  if (hostname === "localhost") return "default"
  if (hostname.endsWith(".localhost")) {
    const slug = hostname.slice(0, -".localhost".length)
    return slug || null
  }

  const rootDomain = process.env.APP_ROOT_DOMAIN?.trim().toLowerCase()
  if (!rootDomain) return null
  if (hostname === rootDomain) return null
  if (!hostname.endsWith(`.${rootDomain}`)) return null

  const slug = hostname.slice(0, -(`.${rootDomain}`.length))
  return slug || null
}

const isPlatformSuperAdmin = (
  role: string | null | undefined,
  hostHeader: string | null
) => {
  if (role !== "ADMIN") return false
  const slug = getTenantSlugFromHost(hostHeader)
  return slug === PLATFORM_TENANT_SLUG
}

export default auth((request) => {
  if (!request.auth?.user) {
    return NextResponse.next()
  }

  const role = (request.auth?.user as { role?: string | null } | undefined)?.role
  const host =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host")

  if (!isPlatformSuperAdmin(role, host)) {
    return NextResponse.next()
  }

  const pathname = request.nextUrl.pathname
  const isTenantApi = pathname === "/api/tenants" || pathname.startsWith("/api/tenants/")
  const isAuthApi = pathname.startsWith("/api/auth/")
  const isTenantSettings = pathname === "/settings/tenants" || pathname.startsWith("/settings/tenants/")
  const isPublicAuthPage = pathname.startsWith("/auth/")

  if (pathname.startsWith("/api/") && !isTenantApi && !isAuthApi) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 })
  }
  if (isTenantApi || isAuthApi) {
    return NextResponse.next()
  }

  if (isTenantSettings || isPublicAuthPage) {
    return NextResponse.next()
  }

  if (pathname === "/dashboard" || pathname.startsWith("/settings/")) {
    return NextResponse.redirect(new URL("/settings/tenants", request.url))
  }

  return NextResponse.redirect(new URL("/settings/tenants", request.url))
})

export const config = {
  matcher: ["/((?!api/auth|auth|_next/static|_next/image|favicon.ico).*)"],
}
