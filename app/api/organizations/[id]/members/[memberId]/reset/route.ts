import crypto from "crypto"
import { NextResponse } from "next/server"

import {
  createApiLogContext,
  logApiRequestError,
  logApiRequestStart,
  logApiRequestSuccess,
  withRequestId,
} from "@/lib/api-logging"
import { recordDomainAuditEventSafe } from "@/lib/domain-audit"
import { resetPasswordEmail } from "@/lib/emails/reset-password"
import { mailer, mailFrom } from "@/lib/mailer"
import {
  canManageOrganizationMembership,
  canManageTargetOrganizationMember,
  requirePlatformConsoleAccess,
} from "@/lib/platform-console"
import { prisma } from "@/lib/prisma"

const buildPlatformOrigin = (request: Request) => {
  const requestUrl = new URL(request.url)
  const protoHeader = request.headers.get("x-forwarded-proto")
  const protocol = protoHeader?.split(",")[0]?.trim() || requestUrl.protocol.replace(":", "")
  const hostHeader =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    requestUrl.host
  const host = hostHeader.split(",")[0]?.trim() || requestUrl.host
  return `${protocol}://${host}`
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const logContext = createApiLogContext(request)
  logApiRequestStart(logContext, request)

  const authorized = await requirePlatformConsoleAccess(request)
  if (authorized.error) {
    logApiRequestSuccess(logContext, authorized.error.status, {
      reason: "unauthorized_or_platform_scope_failed",
    })
    return withRequestId(authorized.error, logContext.requestId)
  }

  try {
    const { id, memberId } = await params
    if (authorized.context.mode === "ORG_MEMBER") {
      if (!authorized.context.organizationIds.includes(id)) {
        const response = NextResponse.json({ error: "Forbidden." }, { status: 403 })
        logApiRequestSuccess(logContext, 403, { reason: "organization_scope_failed", organizationId: id })
        return withRequestId(response, logContext.requestId)
      }
      const membershipRole = authorized.context.organizationRolesById[id]
      if (!canManageOrganizationMembership(membershipRole)) {
        const response = NextResponse.json({ error: "Forbidden." }, { status: 403 })
        logApiRequestSuccess(logContext, 403, {
          reason: "organization_membership_role_insufficient",
          organizationId: id,
        })
        return withRequestId(response, logContext.requestId)
      }
    }

    const membership = await prisma.organizationMembership.findFirst({
      where: {
        id: memberId,
        organizationId: id,
      },
      select: {
        id: true,
        role: true,
        organization: {
          select: {
            id: true,
            slug: true,
          },
        },
        user: {
          select: {
            id: true,
            tenantId: true,
            email: true,
            role: true,
            status: true,
          },
        },
      },
    })
    if (!membership) {
      const response = NextResponse.json({ error: "Organization member not found." }, { status: 404 })
      logApiRequestSuccess(logContext, 404, { reason: "organization_member_not_found", organizationId: id, memberId })
      return withRequestId(response, logContext.requestId)
    }
    if (membership.user.tenantId !== authorized.context.platformTenantId) {
      const response = NextResponse.json(
        { error: "This organization member cannot be managed here." },
        { status: 409 }
      )
      logApiRequestSuccess(logContext, 409, { reason: "member_not_in_platform_tenant", organizationId: id, memberId })
      return withRequestId(response, logContext.requestId)
    }
    if (membership.user.role === "ADMIN") {
      const response = NextResponse.json(
        { error: "Platform admin users cannot be reset from this action." },
        { status: 409 }
      )
      logApiRequestSuccess(logContext, 409, { reason: "platform_admin_restricted", organizationId: id, memberId })
      return withRequestId(response, logContext.requestId)
    }
    if (authorized.context.mode === "ORG_MEMBER") {
      const membershipRole = authorized.context.organizationRolesById[id]
      if (!canManageTargetOrganizationMember(membershipRole, membership.role)) {
        const response = NextResponse.json({ error: "Forbidden." }, { status: 403 })
        logApiRequestSuccess(logContext, 403, {
          reason: "organization_target_role_forbidden",
          organizationId: id,
          memberId,
        })
        return withRequestId(response, logContext.requestId)
      }
    }
    if (membership.user.status === "ARCHIVED") {
      const response = NextResponse.json(
        { error: "Archived members cannot receive reset links." },
        { status: 409 }
      )
      logApiRequestSuccess(logContext, 409, { reason: "member_archived", organizationId: id, memberId })
      return withRequestId(response, logContext.requestId)
    }

    const rawToken = crypto.randomBytes(32).toString("hex")
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex")
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60)

    await prisma.passwordResetToken.deleteMany({ where: { userId: membership.user.id } })
    await prisma.passwordResetToken.create({
      data: {
        userId: membership.user.id,
        tokenHash,
        expiresAt,
      },
    })

    const resetUrl = `${buildPlatformOrigin(request)}/auth/reset-password?token=${rawToken}`

    if (!mailFrom) {
      await recordDomainAuditEventSafe(prisma, {
        tenantId: authorized.context.tenantId,
        event: "organization.member.reset_sent",
        entityType: "OrganizationMembership",
        entityId: membership.id,
        actorUserId: authorized.context.sessionUserId,
        actorRole: authorized.context.role,
        requestId: logContext.requestId,
        metadata: {
          organizationId: membership.organization.id,
          organizationSlug: membership.organization.slug,
          memberUserId: membership.user.id,
          memberEmail: membership.user.email,
          delivery: "manual",
        },
      })

      const response = NextResponse.json({
        ok: true,
        delivery: "manual",
        resetUrl,
      })
      logApiRequestSuccess(logContext, 200, {
        organizationId: id,
        memberId,
        result: "manual_reset_url_returned",
      })
      return withRequestId(response, logContext.requestId)
    }

    const emailTemplate = resetPasswordEmail({ resetUrl })
    await mailer.sendMail({
      from: mailFrom,
      to: membership.user.email,
      subject: emailTemplate.subject,
      text: emailTemplate.text,
      html: emailTemplate.html,
    })

    await recordDomainAuditEventSafe(prisma, {
      tenantId: authorized.context.tenantId,
      event: "organization.member.reset_sent",
      entityType: "OrganizationMembership",
      entityId: membership.id,
      actorUserId: authorized.context.sessionUserId,
      actorRole: authorized.context.role,
      requestId: logContext.requestId,
      metadata: {
        organizationId: membership.organization.id,
        organizationSlug: membership.organization.slug,
        memberUserId: membership.user.id,
        memberEmail: membership.user.email,
        delivery: "email",
      },
    })

    const response = NextResponse.json({
      ok: true,
      delivery: "email",
    })
    logApiRequestSuccess(logContext, 200, { organizationId: id, memberId, result: "reset_sent" })
    return withRequestId(response, logContext.requestId)
  } catch (error) {
    logApiRequestError(logContext, error, 500)
    const response = NextResponse.json(
      { error: "Unable to send organization member reset." },
      { status: 500 }
    )
    return withRequestId(response, logContext.requestId)
  }
}
