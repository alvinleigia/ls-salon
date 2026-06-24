import crypto from "crypto"
import { NextResponse } from "next/server"

import {
  createApiLogContext,
  logApiRequestError,
  logApiRequestStart,
  logApiRequestSuccess,
  withRequestId,
} from "@/lib/api-logging"
import { resetPasswordEmail } from "@/lib/emails/reset-password"
import { mailer, mailFrom } from "@/lib/mailer"
import { canManageTenants, type Role } from "@/lib/permissions"
import { enterRlsBypassDbContext, prisma } from "@/lib/prisma"
import { requireTenantSession } from "@/lib/tenant-auth"
import { recordDomainAuditEventSafe } from "@/lib/domain-audit"

export const runtime = "nodejs"

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

const buildTenantOrigin = (request: Request, tenantSlug: string) => {
  const requestUrl = new URL(request.url)
  const protoHeader = request.headers.get("x-forwarded-proto")
  const protocol = protoHeader?.split(",")[0]?.trim() || requestUrl.protocol.replace(":", "")
  const rootDomain = process.env.APP_ROOT_DOMAIN?.trim().toLowerCase()
  if (rootDomain) {
    return `${protocol}://${tenantSlug}.${rootDomain}`
  }

  const hostHeader =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    requestUrl.host
  const host = hostHeader.split(",")[0]?.trim().toLowerCase() || requestUrl.host.toLowerCase()
  const port = host.includes(":") ? host.split(":")[1] : requestUrl.port
  if (host.includes("localhost")) {
    return `${protocol}://${tenantSlug}.localhost${port ? `:${port}` : ""}`
  }
  return `${protocol}://${host}`
}

export async function POST(
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

  try {
    const { id } = await params
    const tenant = await prisma.tenant.findUnique({
      where: { id },
      select: { id: true, slug: true, status: true },
    })
    if (!tenant) {
      const response = NextResponse.json({ error: "Tenant not found." }, { status: 404 })
      logApiRequestSuccess(logContext, 404, { reason: "tenant_not_found", tenantId: id })
      return withRequestId(response, logContext.requestId)
    }
    if (tenant.slug === PLATFORM_TENANT_SLUG) {
      const response = NextResponse.json(
        { error: "Platform tenant admin reset is not allowed from this action." },
        { status: 409 }
      )
      logApiRequestSuccess(logContext, 409, { reason: "platform_tenant_restricted", tenantId: id })
      return withRequestId(response, logContext.requestId)
    }

    const admin = await prisma.user.findFirst({
      where: {
        tenantId: tenant.id,
        role: "ADMIN",
        status: { not: "ARCHIVED" },
      },
      orderBy: { createdAt: "asc" },
      select: { id: true, email: true },
    })
    if (!admin) {
      const response = NextResponse.json({ error: "Tenant admin user not found." }, { status: 404 })
      logApiRequestSuccess(logContext, 404, { reason: "tenant_admin_not_found", tenantId: id })
      return withRequestId(response, logContext.requestId)
    }

    const rawToken = crypto.randomBytes(32).toString("hex")
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex")
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60)
    await prisma.passwordResetToken.deleteMany({ where: { userId: admin.id } })
    await prisma.passwordResetToken.create({
      data: {
        userId: admin.id,
        tokenHash,
        expiresAt,
      },
    })

    const tenantOrigin = buildTenantOrigin(request, tenant.slug)
    const resetUrl = `${tenantOrigin}/auth/reset-password?token=${rawToken}`

    if (!mailFrom) {
      await recordDomainAuditEventSafe(prisma, {
        tenantId: actorTenantId,
        event: "tenant.admin.reset_sent",
        entityType: "Tenant",
        entityId: tenant.id,
        actorUserId: sessionUserId,
        actorRole,
        requestId: logContext.requestId,
        metadata: {
          delivery: "manual",
          adminUserId: admin.id,
          adminEmail: admin.email,
        },
      })
      const response = NextResponse.json({
        ok: true,
        delivery: "manual",
        resetUrl,
      })
      logApiRequestSuccess(logContext, 200, {
        tenantId: id,
        adminId: admin.id,
        result: "manual_reset_url_returned",
      })
      return withRequestId(response, logContext.requestId)
    }

    const emailTemplate = resetPasswordEmail({ resetUrl })
    await mailer.sendMail({
      from: mailFrom,
      to: admin.email,
      subject: emailTemplate.subject,
      text: emailTemplate.text,
      html: emailTemplate.html,
    })
    await recordDomainAuditEventSafe(prisma, {
      tenantId: actorTenantId,
      event: "tenant.admin.reset_sent",
      entityType: "Tenant",
      entityId: tenant.id,
      actorUserId: sessionUserId,
      actorRole,
      requestId: logContext.requestId,
      metadata: {
        delivery: "email",
        adminUserId: admin.id,
        adminEmail: admin.email,
      },
    })

    const response = NextResponse.json({ ok: true, delivery: "email" })
    logApiRequestSuccess(logContext, 200, {
      tenantId: id,
      adminId: admin.id,
      result: "reset_sent",
    })
    return withRequestId(response, logContext.requestId)
  } catch (error) {
    logApiRequestError(logContext, error, 500)
    const response = NextResponse.json({ error: "Unable to send admin reset." }, { status: 500 })
    return withRequestId(response, logContext.requestId)
  }
}
