import bcrypt from "bcryptjs"
import { Prisma } from "@prisma/client"
import { NextResponse } from "next/server"

import {
  createApiLogContext,
  logApiRequestError,
  logApiRequestStart,
  logApiRequestSuccess,
  withRequestId,
} from "@/lib/api-logging"
import { recordDomainAuditEventSafe } from "@/lib/domain-audit"
import {
  canAssignOrganizationMembershipRole,
  canManageOrganizationMembership,
  canManageTargetOrganizationMember,
  requirePlatformConsoleAccess,
} from "@/lib/platform-console"
import { prisma } from "@/lib/prisma"
import { updateOrganizationMemberSchema } from "@/lib/validation"

const getMembershipForMutation = async (organizationId: string, membershipId: string) =>
  prisma.organizationMembership.findFirst({
    where: {
      id: membershipId,
      organizationId,
    },
    select: {
      id: true,
      role: true,
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      user: {
        select: {
          id: true,
          tenantId: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          status: true,
        },
      },
    },
  })

export async function PATCH(
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

  const payload = await request.json().catch(() => null)
  if (!payload) {
    const response = NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
    logApiRequestSuccess(logContext, 400, { reason: "invalid_json" })
    return withRequestId(response, logContext.requestId)
  }

  const parsed = updateOrganizationMemberSchema.safeParse(payload)
  if (!parsed.success) {
    const response = NextResponse.json(
      { error: "Invalid input.", details: parsed.error.flatten() },
      { status: 400 }
    )
    logApiRequestSuccess(logContext, 400, { reason: "validation_failed" })
    return withRequestId(response, logContext.requestId)
  }

  try {
    const { id, memberId } = await params
    const data = parsed.data
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

    const membership = await getMembershipForMutation(id, memberId)
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
        { error: "Platform admin users cannot be changed from this action." },
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
      if (data.role && !canAssignOrganizationMembershipRole(membershipRole, data.role)) {
        const response = NextResponse.json({ error: "Forbidden." }, { status: 403 })
        logApiRequestSuccess(logContext, 403, {
          reason: "organization_role_assignment_forbidden",
          organizationId: id,
          memberId,
        })
        return withRequestId(response, logContext.requestId)
      }
    }

    const nextEmail = data.email?.trim().toLowerCase()
    if (nextEmail && nextEmail !== membership.user.email.toLowerCase()) {
      const existing = await prisma.user.findUnique({
        where: { email: nextEmail },
        select: { id: true },
      })
      if (existing && existing.id !== membership.user.id) {
        const response = NextResponse.json({ error: "Email already in use." }, { status: 409 })
        logApiRequestSuccess(logContext, 409, { reason: "duplicate_email", organizationId: id, memberId })
        return withRequestId(response, logContext.requestId)
      }
    }

    if (membership.role === "OWNER" && data.role && data.role !== "OWNER") {
      const ownerCount = await prisma.organizationMembership.count({
        where: {
          organizationId: id,
          role: "OWNER",
        },
      })
      if (ownerCount <= 1) {
        const response = NextResponse.json(
          { error: "At least one owner must remain for the organization." },
          { status: 409 }
        )
        logApiRequestSuccess(logContext, 409, {
          reason: "last_owner_protection",
          organizationId: id,
          memberId,
        })
        return withRequestId(response, logContext.requestId)
      }
    }

    const passwordHash = data.password?.trim()
      ? await bcrypt.hash(data.password.trim(), 10)
      : undefined

    const updated = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: membership.user.id },
        data: {
          ...(data.name?.trim() ? { name: data.name.trim() } : {}),
          ...(nextEmail ? { email: nextEmail } : {}),
          ...(data.phone?.trim()
            ? { phone: data.phone.trim() }
            : data.phone === ""
              ? { phone: null }
              : {}),
          ...(data.status ? { status: data.status } : {}),
          ...(passwordHash ? { passwordHash } : {}),
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          status: true,
        },
      })

      const nextRole =
        data.role && data.role !== membership.role
          ? await tx.organizationMembership.update({
              where: { id: membership.id },
              data: { role: data.role },
              select: { role: true },
            })
          : { role: membership.role }

      return { user, role: nextRole.role }
    })

    await recordDomainAuditEventSafe(prisma, {
      tenantId: authorized.context.tenantId,
      event: "organization.member.updated",
      entityType: "OrganizationMembership",
      entityId: membership.id,
      actorUserId: authorized.context.sessionUserId,
      actorRole: authorized.context.role,
      requestId: logContext.requestId,
      metadata: {
        organizationId: membership.organization.id,
        organizationSlug: membership.organization.slug,
        memberUserId: membership.user.id,
      },
      before: {
        name: membership.user.name,
        email: membership.user.email,
        phone: membership.user.phone,
        status: membership.user.status,
        role: membership.role,
      },
      after: {
        name: updated.user.name,
        email: updated.user.email,
        phone: updated.user.phone,
        status: updated.user.status,
        role: updated.role,
      },
    })

    const response = NextResponse.json({
      member: {
        id: membership.id,
        role: updated.role,
        userId: updated.user.id,
        name: updated.user.name,
        email: updated.user.email,
        phone: updated.user.phone,
        userStatus: updated.user.status,
      },
    })
    logApiRequestSuccess(logContext, 200, { organizationId: id, memberId })
    return withRequestId(response, logContext.requestId)
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const response = NextResponse.json({ error: "Email already in use." }, { status: 409 })
      logApiRequestSuccess(logContext, 409, { reason: "p2002_conflict" })
      return withRequestId(response, logContext.requestId)
    }

    logApiRequestError(logContext, error, 500)
    const response = NextResponse.json(
      { error: "Unable to update organization member." },
      { status: 500 }
    )
    return withRequestId(response, logContext.requestId)
  }
}

export async function DELETE(
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

    const membership = await getMembershipForMutation(id, memberId)
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
        { error: "Platform admin users cannot be removed from this action." },
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

    if (membership.role === "OWNER") {
      const ownerCount = await prisma.organizationMembership.count({
        where: {
          organizationId: id,
          role: "OWNER",
        },
      })
      if (ownerCount <= 1) {
        const response = NextResponse.json(
          { error: "At least one owner must remain for the organization." },
          { status: 409 }
        )
        logApiRequestSuccess(logContext, 409, {
          reason: "last_owner_protection",
          organizationId: id,
          memberId,
        })
        return withRequestId(response, logContext.requestId)
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.organizationMembership.delete({
        where: { id: membership.id },
      })

      const remainingMemberships = await tx.organizationMembership.count({
        where: {
          userId: membership.user.id,
        },
      })

      if (remainingMemberships === 0) {
        await tx.passwordResetToken.deleteMany({
          where: { userId: membership.user.id },
        })
        await tx.user.update({
          where: { id: membership.user.id },
          data: {
            status: "ARCHIVED",
            passwordHash: null,
          },
        })
      }

      return { archivedUser: remainingMemberships === 0 }
    })

    await recordDomainAuditEventSafe(prisma, {
      tenantId: authorized.context.tenantId,
      event: "organization.member.removed",
      entityType: "OrganizationMembership",
      entityId: membership.id,
      actorUserId: authorized.context.sessionUserId,
      actorRole: authorized.context.role,
      requestId: logContext.requestId,
      metadata: {
        organizationId: membership.organization.id,
        organizationSlug: membership.organization.slug,
        memberUserId: membership.user.id,
        userArchived: result.archivedUser,
      },
      before: {
        name: membership.user.name,
        email: membership.user.email,
        phone: membership.user.phone,
        status: membership.user.status,
        role: membership.role,
      },
    })

    const response = NextResponse.json({
      ok: true,
      userArchived: result.archivedUser,
    })
    logApiRequestSuccess(logContext, 200, {
      organizationId: id,
      memberId,
      userArchived: result.archivedUser,
    })
    return withRequestId(response, logContext.requestId)
  } catch (error) {
    logApiRequestError(logContext, error, 500)
    const response = NextResponse.json(
      { error: "Unable to remove organization member." },
      { status: 500 }
    )
    return withRequestId(response, logContext.requestId)
  }
}
