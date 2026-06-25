import { NextResponse } from "next/server"
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
import { requirePlatformConsoleAccess } from "@/lib/platform-console"
import { prisma } from "@/lib/prisma"
import { createOrganizationSchema } from "@/lib/validation"
import type { ListResponse } from "@/types/api"

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(120).optional(),
})

export async function GET(request: Request) {
  const logContext = createApiLogContext(request)
  logApiRequestStart(logContext, request)

  const authorized = await requirePlatformConsoleAccess(request)
  if (authorized.error) {
    logApiRequestSuccess(logContext, authorized.error.status, {
      reason: "unauthorized_or_platform_scope_failed",
    })
    return withRequestId(authorized.error, logContext.requestId)
  }

  const parsed = listSchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams.entries())
  )
  if (!parsed.success) {
    const response = NextResponse.json(
      { error: "Invalid query parameters.", details: parsed.error.flatten() },
      { status: 400 }
    )
    logApiRequestSuccess(logContext, 400, { reason: "validation_failed" })
    return withRequestId(response, logContext.requestId)
  }

  try {
    const { page, pageSize, q } = parsed.data
    const where: Prisma.OrganizationWhereInput = q
      ? {
          OR: [
            { name: { contains: q, mode: Prisma.QueryMode.insensitive } },
            { slug: { contains: q, mode: Prisma.QueryMode.insensitive } },
          ],
        }
      : {}
    if (authorized.context.mode === "ORG_MEMBER") {
      where.id = { in: authorized.context.organizationIds }
    }
    const skip = (page - 1) * pageSize

    const [total, items] = await prisma.$transaction([
      prisma.organization.count({ where }),
      prisma.organization.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        select: {
          id: true,
          name: true,
          slug: true,
          createdAt: true,
          _count: {
            select: {
              tenants: true,
              memberships: true,
            },
          },
        },
      }),
    ])

    const response: ListResponse<{
      id: string
      name: string
      slug: string
      tenantCount: number
      memberCount: number
      createdAt: string
    }> = {
      items: items.map((item) => ({
        id: item.id,
        name: item.name,
        slug: item.slug,
        tenantCount: item._count.tenants,
        memberCount: item._count.memberships,
        createdAt: item.createdAt.toISOString(),
      })),
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    }

    const json = NextResponse.json(response)
    logApiRequestSuccess(logContext, 200, { page, pageSize, total })
    return withRequestId(json, logContext.requestId)
  } catch (error) {
    logApiRequestError(logContext, error, 500)
    const response = NextResponse.json(
      { error: "Unable to load organizations." },
      { status: 500 }
    )
    return withRequestId(response, logContext.requestId)
  }
}

export async function POST(request: Request) {
  const logContext = createApiLogContext(request)
  logApiRequestStart(logContext, request)

  const authorized = await requirePlatformConsoleAccess(request, { requireSuperAdmin: true })
  if (authorized.error) {
    logApiRequestSuccess(logContext, authorized.error.status, {
      reason: "unauthorized_or_platform_scope_failed",
    })
    return withRequestId(authorized.error, logContext.requestId)
  }

  const { tenantId: actorTenantId, role: actorRole, sessionUserId } = authorized.context
  const payload = await request.json().catch(() => null)

  if (!payload) {
    const response = NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
    logApiRequestSuccess(logContext, 400, { reason: "invalid_json" })
    return withRequestId(response, logContext.requestId)
  }

  const parsed = createOrganizationSchema.safeParse(payload)
  if (!parsed.success) {
    const response = NextResponse.json(
      { error: "Invalid input.", details: parsed.error.flatten() },
      { status: 400 }
    )
    logApiRequestSuccess(logContext, 400, { reason: "validation_failed" })
    return withRequestId(response, logContext.requestId)
  }

  try {
    const data = parsed.data
    const normalizedSlug = data.slug.trim().toLowerCase()

    const existing = await prisma.organization.findUnique({
      where: { slug: normalizedSlug },
      select: { id: true },
    })
    if (existing) {
      const response = NextResponse.json(
        { error: "Organization slug already exists." },
        { status: 409 }
      )
      logApiRequestSuccess(logContext, 409, { reason: "duplicate_organization_slug" })
      return withRequestId(response, logContext.requestId)
    }

    const created = await prisma.organization.create({
      data: {
        name: data.name.trim(),
        slug: normalizedSlug,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
      },
    })

    await recordDomainAuditEventSafe(prisma, {
      tenantId: actorTenantId,
      event: "organization.created",
      entityType: "Organization",
      entityId: created.id,
      actorUserId: sessionUserId,
      actorRole,
      requestId: logContext.requestId,
      metadata: {
        organizationSlug: created.slug,
      },
      after: {
        name: created.name,
        slug: created.slug,
      },
    })

    const response = NextResponse.json(
      {
        organization: {
          id: created.id,
          name: created.name,
          slug: created.slug,
          createdAt: created.createdAt.toISOString(),
        },
      },
      { status: 201 }
    )
    logApiRequestSuccess(logContext, 201, { organizationSlug: created.slug })
    return withRequestId(response, logContext.requestId)
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const response = NextResponse.json(
        { error: "Organization slug already exists." },
        { status: 409 }
      )
      logApiRequestSuccess(logContext, 409, { reason: "p2002_conflict" })
      return withRequestId(response, logContext.requestId)
    }
    logApiRequestError(logContext, error, 500)
    const response = NextResponse.json(
      { error: "Unable to create organization." },
      { status: 500 }
    )
    return withRequestId(response, logContext.requestId)
  }
}
