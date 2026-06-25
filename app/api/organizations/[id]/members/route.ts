import crypto from "crypto"
import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { Prisma } from "@prisma/client"
import { z } from "zod"

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
  canAssignOrganizationMembershipRole,
  canManageOrganizationMembership,
  requirePlatformConsoleAccess,
} from "@/lib/platform-console"
import { prisma } from "@/lib/prisma"
import { createOrganizationMemberSchema } from "@/lib/validation"
import type { ListResponse } from "@/types/api"

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(120).optional(),
})

const organizationMembershipRoleValues = ["OWNER", "ADMIN", "VIEWER"] as const

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

const createPasswordResetLink = async (userId: string, origin: string) => {
  const rawToken = crypto.randomBytes(32).toString("hex")
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex")
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60)

  await prisma.passwordResetToken.deleteMany({ where: { userId } })
  await prisma.passwordResetToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  })

  return `${origin}/auth/reset-password?token=${rawToken}`
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
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

  const { id } = await params
  const parsed = listSchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams.entries())
  )
  if (!parsed.success) {
    const response = NextResponse.json(
      { error: "Invalid query parameters.", details: parsed.error.flatten() },
      { status: 400 }
    )
    logApiRequestSuccess(logContext, 400, { reason: "validation_failed", organizationId: id })
    return withRequestId(response, logContext.requestId)
  }

  try {
    const organization = await prisma.organization.findUnique({
      where: { id },
      select: { id: true },
    })
    if (!organization) {
      const response = NextResponse.json({ error: "Organization not found." }, { status: 404 })
      logApiRequestSuccess(logContext, 404, { reason: "organization_not_found", organizationId: id })
      return withRequestId(response, logContext.requestId)
    }
    if (
      authorized.context.mode === "ORG_MEMBER" &&
      !authorized.context.organizationIds.includes(id)
    ) {
      const response = NextResponse.json({ error: "Forbidden." }, { status: 403 })
      logApiRequestSuccess(logContext, 403, { reason: "organization_scope_failed", organizationId: id })
      return withRequestId(response, logContext.requestId)
    }

    const { page, pageSize, q } = parsed.data
    const normalizedRoleQuery = q?.trim().toUpperCase()
    const skip = (page - 1) * pageSize
    const where: Prisma.OrganizationMembershipWhereInput = {
      organizationId: id,
      ...(q
        ? {
            OR: [
              ...(normalizedRoleQuery &&
              organizationMembershipRoleValues.includes(
                normalizedRoleQuery as (typeof organizationMembershipRoleValues)[number]
              )
                ? [
                    {
                      role: normalizedRoleQuery as (typeof organizationMembershipRoleValues)[number],
                    },
                  ]
                : []),
              { user: { name: { contains: q, mode: Prisma.QueryMode.insensitive } } },
              { user: { email: { contains: q, mode: Prisma.QueryMode.insensitive } } } ,
            ],
          }
        : {}),
    }

    const [total, items] = await prisma.$transaction([
      prisma.organizationMembership.count({ where }),
      prisma.organizationMembership.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        select: {
          id: true,
          role: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              status: true,
            },
          },
        },
      }),
    ])

    const response: ListResponse<{
      id: string
      role: "OWNER" | "ADMIN" | "VIEWER"
      userId: string
      name: string | null
      email: string
      phone: string | null
      userStatus: "ACTIVE" | "SUSPENDED" | "INVITED" | "ARCHIVED"
      createdAt: string
    }> = {
      items: items.map((item) => ({
        id: item.id,
        role: item.role,
        userId: item.user.id,
        name: item.user.name,
        email: item.user.email,
        phone: item.user.phone,
        userStatus: item.user.status,
        createdAt: item.createdAt.toISOString(),
      })),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    }

    const json = NextResponse.json(response)
    logApiRequestSuccess(logContext, 200, { organizationId: id, page, pageSize, total })
    return withRequestId(json, logContext.requestId)
  } catch (error) {
    logApiRequestError(logContext, error, 500, { organizationId: id })
    const response = NextResponse.json(
      { error: "Unable to load organization members." },
      { status: 500 }
    )
    return withRequestId(response, logContext.requestId)
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
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

  const { id } = await params
  const {
    tenantId: actorTenantId,
    role: actorRole,
    sessionUserId,
    platformTenantId,
  } = authorized.context

  const payload = await request.json().catch(() => null)
  if (!payload) {
    const response = NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
    logApiRequestSuccess(logContext, 400, { reason: "invalid_json", organizationId: id })
    return withRequestId(response, logContext.requestId)
  }

  const parsed = createOrganizationMemberSchema.safeParse(payload)
  if (!parsed.success) {
    const response = NextResponse.json(
      { error: "Invalid input.", details: parsed.error.flatten() },
      { status: 400 }
    )
    logApiRequestSuccess(logContext, 400, { reason: "validation_failed", organizationId: id })
    return withRequestId(response, logContext.requestId)
  }

  try {
    const organization = await prisma.organization.findUnique({
      where: { id },
      select: { id: true, name: true, slug: true },
    })
    if (!organization) {
      const response = NextResponse.json({ error: "Organization not found." }, { status: 404 })
      logApiRequestSuccess(logContext, 404, { reason: "organization_not_found", organizationId: id })
      return withRequestId(response, logContext.requestId)
    }
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
      if (!canAssignOrganizationMembershipRole(membershipRole, data.role)) {
        const response = NextResponse.json({ error: "Forbidden." }, { status: 403 })
        logApiRequestSuccess(logContext, 403, {
          reason: "organization_membership_role_assignment_forbidden",
          organizationId: id,
        })
        return withRequestId(response, logContext.requestId)
      }
    }
    const normalizedEmail = data.email.trim().toLowerCase()
    const rawPassword = data.password?.trim() || ""
    const passwordHash = rawPassword ? await bcrypt.hash(rawPassword, 10) : null

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    })
    if (existingUser) {
      const response = NextResponse.json(
        { error: "A user with this email already exists." },
        { status: 409 }
      )
      logApiRequestSuccess(logContext, 409, { reason: "duplicate_user_email", organizationId: id })
      return withRequestId(response, logContext.requestId)
    }

    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          tenantId: platformTenantId,
          name: data.name.trim(),
          email: normalizedEmail,
          phone: data.phone?.trim() || null,
          role: "CUSTOMER",
          status: passwordHash ? "ACTIVE" : "INVITED",
          passwordHash,
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          status: true,
        },
      })

      const membership = await tx.organizationMembership.create({
        data: {
          organizationId: organization.id,
          userId: user.id,
          role: data.role,
        },
        select: {
          id: true,
          role: true,
          createdAt: true,
        },
      })

      return { user, membership }
    })

    let onboarding:
      | {
          delivery: "email" | "manual"
          resetUrl?: string
        }
      | undefined

    if (!passwordHash) {
      const resetUrl = await createPasswordResetLink(
        created.user.id,
        buildPlatformOrigin(request)
      )

      if (!mailFrom) {
        onboarding = {
          delivery: "manual",
          resetUrl,
        }
      } else {
        const emailTemplate = resetPasswordEmail({ resetUrl })
        await mailer.sendMail({
          from: mailFrom,
          to: created.user.email,
          subject: emailTemplate.subject,
          text: emailTemplate.text,
          html: emailTemplate.html,
        })
        onboarding = { delivery: "email" }
      }
    }

    await recordDomainAuditEventSafe(prisma, {
      tenantId: actorTenantId,
      event: "organization.member.added",
      entityType: "OrganizationMembership",
      entityId: created.membership.id,
      actorUserId: sessionUserId,
      actorRole,
      requestId: logContext.requestId,
      metadata: {
        organizationId: organization.id,
        organizationSlug: organization.slug,
        memberUserId: created.user.id,
        memberEmail: created.user.email,
        onboarding: onboarding?.delivery ?? "password",
      },
      after: {
        organizationId: organization.id,
        organizationName: organization.name,
        userId: created.user.id,
        email: created.user.email,
        role: created.membership.role,
        userStatus: created.user.status,
      },
    })

    const response = NextResponse.json(
      {
        member: {
          id: created.membership.id,
          role: created.membership.role,
          userId: created.user.id,
          name: created.user.name,
          email: created.user.email,
          phone: created.user.phone,
          userStatus: created.user.status,
          createdAt: created.membership.createdAt.toISOString(),
        },
        onboarding,
      },
      { status: 201 }
    )
    logApiRequestSuccess(logContext, 201, {
      organizationId: id,
      memberUserId: created.user.id,
      memberEmail: created.user.email,
      onboarding: onboarding?.delivery ?? "password",
    })
    return withRequestId(response, logContext.requestId)
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const response = NextResponse.json(
        { error: "This member already exists for the organization." },
        { status: 409 }
      )
      logApiRequestSuccess(logContext, 409, { reason: "p2002_conflict", organizationId: id })
      return withRequestId(response, logContext.requestId)
    }

    logApiRequestError(logContext, error, 500, { organizationId: id })
    const response = NextResponse.json(
      { error: "Unable to add organization member." },
      { status: 500 }
    )
    return withRequestId(response, logContext.requestId)
  }
}
