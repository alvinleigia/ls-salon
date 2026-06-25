import { NextResponse } from "next/server"

import { prisma, enterRlsBypassDbContext } from "@/lib/prisma"
import { requireTenantSession } from "@/lib/tenant-auth"

const PLATFORM_TENANT_SLUG = (
  process.env.PLATFORM_ADMIN_TENANT_SLUG?.trim().toLowerCase() || "platform"
)

export type PlatformConsoleMode = "SUPER_ADMIN" | "ORG_MEMBER"
export type OrganizationMembershipRole = "OWNER" | "ADMIN" | "VIEWER"

export type PlatformConsoleAccess = {
  platformTenantId: string
  mode: PlatformConsoleMode
  organizationIds: string[]
  organizationRolesById: Record<string, OrganizationMembershipRole>
}

type ResolvePlatformConsoleAccessInput = {
  tenantId?: string | null
  role?: string | null
  sessionUserId?: string | null
}

export const resolvePlatformConsoleAccess = async (
  input: ResolvePlatformConsoleAccessInput
): Promise<PlatformConsoleAccess | null> => {
  if (!input.tenantId) return null

  enterRlsBypassDbContext()

  const tenant = await prisma.tenant.findUnique({
    where: { id: input.tenantId },
    select: { id: true, slug: true },
  })
  if (!tenant || tenant.slug !== PLATFORM_TENANT_SLUG) {
    return null
  }

  if (input.role === "ADMIN") {
    return {
      platformTenantId: tenant.id,
      mode: "SUPER_ADMIN",
      organizationIds: [],
      organizationRolesById: {},
    }
  }

  if (!input.sessionUserId) return null

  const memberships = await prisma.organizationMembership.findMany({
    where: { userId: input.sessionUserId },
    select: {
      organizationId: true,
      role: true,
    },
  })
  if (memberships.length === 0) {
    return null
  }

  return {
    platformTenantId: tenant.id,
    mode: "ORG_MEMBER",
    organizationIds: memberships.map((membership) => membership.organizationId),
    organizationRolesById: Object.fromEntries(
      memberships.map((membership) => [membership.organizationId, membership.role])
    ),
  }
}

export const getPlatformConsoleAccessFromSession = async (
  session: {
    user?: {
      tenantId?: string | null
      role?: string | null
      id?: string | null
    } | null
  } | null
) => {
  if (!session?.user) return null

  return resolvePlatformConsoleAccess({
    tenantId: session.user.tenantId ?? null,
    role: session.user.role ?? null,
    sessionUserId: session.user.id ?? null,
  })
}

export const requirePlatformConsoleAccess = async (
  request: Request,
  options?: {
    requireSuperAdmin?: boolean
  }
) => {
  const tenantSession = await requireTenantSession(request)
  if (tenantSession.error) return { error: tenantSession.error }

  const access = await resolvePlatformConsoleAccess({
    tenantId: tenantSession.context.tenantId,
    role: tenantSession.context.role,
    sessionUserId: tenantSession.context.sessionUserId,
  })
  if (!access) {
    return { error: NextResponse.json({ error: "Forbidden." }, { status: 403 }) }
  }

  if (options?.requireSuperAdmin && access.mode !== "SUPER_ADMIN") {
    return { error: NextResponse.json({ error: "Forbidden." }, { status: 403 }) }
  }

  return {
    context: {
      ...tenantSession.context,
      ...access,
    },
  }
}

export const isOrganizationScopedUser = (access: PlatformConsoleAccess | null) =>
  access?.mode === "ORG_MEMBER"

export const canManageOrganizationMembership = (
  role: OrganizationMembershipRole | undefined
) => role === "OWNER" || role === "ADMIN"

export const canAssignOrganizationMembershipRole = (
  actorRole: OrganizationMembershipRole | undefined,
  nextRole: OrganizationMembershipRole
) => {
  if (actorRole === "OWNER") return true
  if (actorRole === "ADMIN") return nextRole !== "OWNER"
  return false
}

export const canManageTargetOrganizationMember = (
  actorRole: OrganizationMembershipRole | undefined,
  targetRole: OrganizationMembershipRole
) => {
  if (actorRole === "OWNER") return true
  if (actorRole === "ADMIN") return targetRole !== "OWNER"
  return false
}
