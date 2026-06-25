import { headers } from "next/headers"

import { prisma } from "@/lib/prisma"

const PLATFORM_TENANT_SLUG = (
  process.env.PLATFORM_ADMIN_TENANT_SLUG?.trim().toLowerCase() || "platform"
)

export type TenantContext = {
  id: string
  slug: string
  name: string
}

export const normalizeHostname = (value: string) =>
  value.trim().toLowerCase().replace(/\.+$/, "")

const getHostname = (hostHeader: string) => normalizeHostname(hostHeader.split(":")[0].trim())

export const isManagedTenantHostname = (hostname: string) => {
  const normalizedHostname = normalizeHostname(hostname)
  if (!normalizedHostname) return false
  if (normalizedHostname === "localhost" || normalizedHostname.endsWith(".localhost")) {
    return true
  }

  const rootDomain = process.env.APP_ROOT_DOMAIN?.trim().toLowerCase()
  if (!rootDomain) return false
  return (
    normalizedHostname === rootDomain ||
    normalizedHostname.endsWith(`.${rootDomain}`)
  )
}

export const getTenantSlugFromHost = (hostHeader: string | null | undefined) => {
  if (!hostHeader) return null
  const hostname = getHostname(hostHeader)

  if (hostname === "localhost") {
    return PLATFORM_TENANT_SLUG
  }

  if (hostname.endsWith(".localhost")) {
    const slug = hostname.slice(0, -".localhost".length)
    return slug || null
  }

  const rootDomain = process.env.APP_ROOT_DOMAIN?.trim().toLowerCase()
  if (!rootDomain) return null
  if (hostname === rootDomain) return PLATFORM_TENANT_SLUG
  if (!hostname.endsWith(`.${rootDomain}`)) return null

  const slug = hostname.slice(0, -(`.${rootDomain}`.length))
  return slug || null
}

export const resolveTenantBySlug = async (slug: string) => {
  const tenant = await prisma.tenant.findFirst({
    where: { slug, status: "ACTIVE" },
    select: { id: true, slug: true, name: true },
  })
  if (tenant) return tenant
  return null
}

export const resolveTenantByCustomHostname = async (hostname: string) => {
  const normalizedHostname = normalizeHostname(hostname)
  if (!normalizedHostname) return null

  const tenantDomain = await prisma.tenantDomain.findUnique({
    where: { hostname: normalizedHostname },
    select: {
      tenant: {
        select: { id: true, slug: true, name: true, status: true },
      },
    },
  })

  if (tenantDomain?.tenant?.status !== "ACTIVE") return null
  return {
    id: tenantDomain.tenant.id,
    slug: tenantDomain.tenant.slug,
    name: tenantDomain.tenant.name,
  }
}

export const resolveTenantFromHostHeader = async (hostHeader: string | null | undefined) => {
  const hostname = hostHeader ? getHostname(hostHeader) : null
  if (!hostname) return null

  const slug = getTenantSlugFromHost(hostHeader)
  if (slug) {
    const tenantBySlug = await resolveTenantBySlug(slug)
    if (tenantBySlug) return tenantBySlug
  }

  if (!isManagedTenantHostname(hostname)) {
    return resolveTenantByCustomHostname(hostname)
  }

  return null
}

export const resolveTenantFromRequest = async (request: Request) => {
  const host =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host")
  return resolveTenantFromHostHeader(host)
}

export const resolveTenantFromServerHeaders = async () => {
  const headerList = await headers()
  const host =
    headerList.get("x-forwarded-host") ??
    headerList.get("host")
  return resolveTenantFromHostHeader(host)
}
