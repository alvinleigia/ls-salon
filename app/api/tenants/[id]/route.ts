import { NextResponse } from "next/server"

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
      select: { id: true, slug: true, status: true },
    })
    if (!tenant) {
      const response = NextResponse.json({ error: "Tenant not found." }, { status: 404 })
      logApiRequestSuccess(logContext, 404, { reason: "not_found", tenantId: id })
      return withRequestId(response, logContext.requestId)
    }
    if (tenant.slug === PLATFORM_TENANT_SLUG) {
      const response = NextResponse.json(
        { error: "Platform tenant status cannot be changed." },
        { status: 409 }
      )
      logApiRequestSuccess(logContext, 409, { reason: "platform_tenant_restricted", tenantId: id })
      return withRequestId(response, logContext.requestId)
    }

    if (tenant.status === parsed.data.status) {
      const response = NextResponse.json(
        { error: "Tenant already has this status." },
        { status: 409 }
      )
      logApiRequestSuccess(logContext, 409, { reason: "status_noop", tenantId: id })
      return withRequestId(response, logContext.requestId)
    }

    const updated = await prisma.tenant.update({
      where: { id },
      data: { status: parsed.data.status },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        createdAt: true,
        _count: { select: { users: true } },
      },
    })
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

    const response = NextResponse.json({
      tenant: {
        id: updated.id,
        name: updated.name,
        slug: updated.slug,
        status: updated.status,
        userCount: updated._count.users,
        createdAt: updated.createdAt.toISOString(),
      },
    })
    logApiRequestSuccess(logContext, 200, {
      tenantId: id,
      previousStatus: tenant.status,
      nextStatus: updated.status,
    })
    return withRequestId(response, logContext.requestId)
  } catch (error) {
    logApiRequestError(logContext, error, 500, { tenantId: id })
    const response = NextResponse.json({ error: "Unable to update tenant." }, { status: 500 })
    return withRequestId(response, logContext.requestId)
  }
}
