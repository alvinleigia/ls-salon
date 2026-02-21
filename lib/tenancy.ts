import { headers } from "next/headers"

import { prisma } from "@/lib/prisma"

const DEFAULT_DEV_SLUG = "default"

export type TenantContext = {
  id: string
  slug: string
  name: string
}

const getHostname = (hostHeader: string) => hostHeader.split(":")[0].trim().toLowerCase()

export const getTenantSlugFromHost = (hostHeader: string | null | undefined) => {
  if (!hostHeader) return null
  const hostname = getHostname(hostHeader)

  if (hostname === "localhost") {
    return DEFAULT_DEV_SLUG
  }

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

export const resolveTenantBySlug = async (slug: string) => {
  const tenant = await prisma.tenant.findFirst({
    where: { slug, status: "ACTIVE" },
    select: { id: true, slug: true, name: true },
  })
  if (tenant) return tenant

  if (slug === DEFAULT_DEV_SLUG && process.env.NODE_ENV !== "production") {
    return prisma.tenant.upsert({
      where: { slug: DEFAULT_DEV_SLUG },
      update: { status: "ACTIVE" },
      create: {
        slug: DEFAULT_DEV_SLUG,
        name: "Default Tenant",
        status: "ACTIVE",
      },
      select: { id: true, slug: true, name: true },
    })
  }
  return null
}

export const resolveTenantFromHostHeader = async (hostHeader: string | null | undefined) => {
  const slug = getTenantSlugFromHost(hostHeader)
  if (!slug) return null
  return resolveTenantBySlug(slug)
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
