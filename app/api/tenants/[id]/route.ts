import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"

import {
  createApiLogContext,
  logApiRequestError,
  logApiRequestStart,
  logApiRequestSuccess,
  withRequestId,
} from "@/lib/api-logging"
import { canManageTenants, type Role } from "@/lib/permissions"
import { enterRlsBypassDbContext, prisma } from "@/lib/prisma"
import { requireTenantSession } from "@/lib/tenant-auth"
import { isManagedTenantHostname, normalizeHostname } from "@/lib/tenancy"
import { updateTenantStatusSchema } from "@/lib/validation"
import { recordDomainAuditEventSafe } from "@/lib/domain-audit"

const PLATFORM_TENANT_SLUG = (
  process.env.PLATFORM_ADMIN_TENANT_SLUG?.trim().toLowerCase() || "platform"
)

const ensureProvisioningAccess = async (request: Request) => {
  const tenantSession = await requireTenantSession(request)
  if (tenantSession.error) return { error: tenantSession.error }
  if (!canManageTenants(tenantSession.context.role as Role)) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const sessionTenant = await prisma.tenant.findFirst({
    where: { id: tenantSession.context.tenantId },
    select: { id: true, slug: true },
  })
  if (!sessionTenant || sessionTenant.slug !== PLATFORM_TENANT_SLUG) {
    return { error: NextResponse.json({ error: "Forbidden." }, { status: 403 }) }
  }

  enterRlsBypassDbContext()

  return { context: tenantSession.context }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const logContext = createApiLogContext(request)
  logApiRequestStart(logContext, request)

  const authorized = await ensureProvisioningAccess(request)
  if (authorized.error) {
    logApiRequestSuccess(logContext, authorized.error.status, {
      reason: "unauthorized_or_platform_scope_failed",
    })
    return withRequestId(authorized.error, logContext.requestId)
  }
  const { tenantId: actorTenantId, role: actorRole, sessionUserId } = authorized.context

  const { id } = await params
  const payload = await request.json().catch(() => null)
  if (!payload) {
    const response = NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
    logApiRequestSuccess(logContext, 400, { reason: "invalid_json", tenantId: id })
    return withRequestId(response, logContext.requestId)
  }

  const parsed = updateTenantStatusSchema.safeParse(payload)
  if (!parsed.success) {
    const response = NextResponse.json(
      { error: "Invalid input.", details: parsed.error.flatten() },
      { status: 400 }
    )
    logApiRequestSuccess(logContext, 400, { reason: "validation_failed", tenantId: id })
    return withRequestId(response, logContext.requestId)
  }

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        domains: {
          orderBy: { createdAt: "asc" },
          take: 1,
          select: { hostname: true },
        },
      },
    })
    if (!tenant) {
      const response = NextResponse.json({ error: "Tenant not found." }, { status: 404 })
      logApiRequestSuccess(logContext, 404, { reason: "not_found", tenantId: id })
      return withRequestId(response, logContext.requestId)
    }
    if (tenant.slug === PLATFORM_TENANT_SLUG) {
      const response = NextResponse.json(
        { error: "Platform tenant cannot be changed from this action." },
        { status: 409 }
      )
      logApiRequestSuccess(logContext, 409, { reason: "platform_tenant_restricted", tenantId: id })
      return withRequestId(response, logContext.requestId)
    }

    const currentCustomDomain = tenant.domains[0]?.hostname ?? null
    const hasStatusChange = Boolean(parsed.data.status && tenant.status !== parsed.data.status)
    const normalizedCustomDomain =
      parsed.data.customDomain === undefined
        ? undefined
        : parsed.data.customDomain
          ? normalizeHostname(parsed.data.customDomain)
          : null
    const hasCustomDomainChange =
      normalizedCustomDomain !== undefined && normalizedCustomDomain !== currentCustomDomain

    if (normalizedCustomDomain && isManagedTenantHostname(normalizedCustomDomain)) {
      const response = NextResponse.json(
        { error: "Custom domain must be outside the managed tenant root domain." },
        { status: 409 }
      )
      logApiRequestSuccess(logContext, 409, {
        reason: "custom_domain_conflicts_with_managed_root",
        tenantId: id,
      })
      return withRequestId(response, logContext.requestId)
    }

    if (!hasStatusChange && !hasCustomDomainChange) {
      const response = NextResponse.json(
        { error: "Tenant already has these values." },
        { status: 409 }
      )
      logApiRequestSuccess(logContext, 409, { reason: "tenant_update_noop", tenantId: id })
      return withRequestId(response, logContext.requestId)
    }

    if (hasCustomDomainChange && normalizedCustomDomain) {
      const existingDomain = await prisma.tenantDomain.findUnique({
        where: { hostname: normalizedCustomDomain },
        select: { tenantId: true },
      })
      if (existingDomain && existingDomain.tenantId !== tenant.id) {
        const response = NextResponse.json({ error: "Custom domain already exists." }, { status: 409 })
        logApiRequestSuccess(logContext, 409, { reason: "duplicate_custom_domain", tenantId: id })
        return withRequestId(response, logContext.requestId)
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (hasStatusChange) {
        await tx.tenant.update({
          where: { id },
          data: { status: parsed.data.status },
        })
      }

      if (hasCustomDomainChange) {
        await tx.tenantDomain.deleteMany({ where: { tenantId: id } })
        if (normalizedCustomDomain) {
          await tx.tenantDomain.create({
            data: {
              tenantId: id,
              hostname: normalizedCustomDomain,
            },
          })
        }
      }

      return tx.tenant.findUniqueOrThrow({
        where: { id },
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          createdAt: true,
          domains: {
            orderBy: { createdAt: "asc" },
            take: 1,
            select: { hostname: true },
          },
          _count: { select: { users: true } },
        },
      })
    })
    if (hasStatusChange) {
      await recordDomainAuditEventSafe(prisma, {
        tenantId: actorTenantId,
        event: "tenant.status.updated",
        entityType: "Tenant",
        entityId: updated.id,
        actorUserId: sessionUserId,
        actorRole,
        requestId: logContext.requestId,
        before: {
          status: tenant.status,
        },
        after: {
          status: updated.status,
        },
      })
    }
    if (hasCustomDomainChange) {
      await recordDomainAuditEventSafe(prisma, {
        tenantId: actorTenantId,
        event: "tenant.domain.updated",
        entityType: "Tenant",
        entityId: updated.id,
        actorUserId: sessionUserId,
        actorRole,
        requestId: logContext.requestId,
        before: {
          customDomain: currentCustomDomain,
        },
        after: {
          customDomain: updated.domains[0]?.hostname ?? null,
        },
      })
    }

    const response = NextResponse.json({
      tenant: {
        id: updated.id,
        name: updated.name,
        slug: updated.slug,
        status: updated.status,
        userCount: updated._count.users,
        customDomain: updated.domains[0]?.hostname ?? null,
        createdAt: updated.createdAt.toISOString(),
      },
    })
    logApiRequestSuccess(logContext, 200, {
      tenantId: id,
      previousStatus: tenant.status,
      nextStatus: updated.status,
      previousCustomDomain: currentCustomDomain,
      nextCustomDomain: updated.domains[0]?.hostname ?? null,
    })
    return withRequestId(response, logContext.requestId)
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const response = NextResponse.json({ error: "Custom domain already exists." }, { status: 409 })
      logApiRequestSuccess(logContext, 409, { reason: "p2002_conflict", tenantId: id })
      return withRequestId(response, logContext.requestId)
    }
    logApiRequestError(logContext, error, 500, { tenantId: id })
    const response = NextResponse.json({ error: "Unable to update tenant." }, { status: 500 })
    return withRequestId(response, logContext.requestId)
  }
}
