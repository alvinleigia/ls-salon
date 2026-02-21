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
import { canManageUsers, type Role } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { requireTenantSession } from "@/lib/tenant-auth"
import type { ListResponse } from "@/types/api"
import type { AuditLogReportRow } from "@/types/reports"

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().optional(),
  event: z.string().trim().optional(),
  entityType: z.string().trim().optional(),
  actorUserId: z.string().trim().optional(),
  requestId: z.string().trim().optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sort: z.enum(["createdAt", "event", "entityType"]).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
})

const serialize = (
  row: Prisma.AuditLogGetPayload<{
    include: { actorUser: { select: { id: true; name: true; email: true } } }
  }>
): AuditLogReportRow => ({
  id: row.id,
  event: row.event,
  entityType: row.entityType,
  entityId: row.entityId,
  actorUserId: row.actorUserId,
  actorRole: row.actorRole,
  actorName: row.actorUser?.name ?? null,
  actorEmail: row.actorUser?.email ?? null,
  requestId: row.requestId,
  metadata: row.metadata,
  before: row.before,
  after: row.after,
  createdAt: row.createdAt.toISOString(),
})

export async function GET(request: Request) {
  const logContext = createApiLogContext(request)
  logApiRequestStart(logContext, request)

  const tenantSession = await requireTenantSession(request)
  if (tenantSession.error) {
    logApiRequestSuccess(logContext, tenantSession.error.status, { reason: "tenant_or_auth_failed" })
    return withRequestId(tenantSession.error, logContext.requestId)
  }
  if (!canManageUsers(tenantSession.context.role as Role)) {
    const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    logApiRequestSuccess(logContext, 401, { reason: "unauthorized" })
    return withRequestId(response, logContext.requestId)
  }
  const { tenantId } = tenantSession.context

  try {
    const parsed = querySchema.safeParse(
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

    const { page, pageSize, q, event, entityType, actorUserId, requestId, dateFrom, dateTo, sort, order } =
      parsed.data

    const where: Prisma.AuditLogWhereInput = {
      tenantId,
      ...(event ? { event: { contains: event, mode: Prisma.QueryMode.insensitive } } : {}),
      ...(entityType ? { entityType: { contains: entityType, mode: Prisma.QueryMode.insensitive } } : {}),
      ...(actorUserId ? { actorUserId } : {}),
      ...(requestId ? { requestId: { contains: requestId, mode: Prisma.QueryMode.insensitive } } : {}),
      ...(dateFrom || dateTo
        ? {
            createdAt: {
              ...(dateFrom ? { gte: new Date(`${dateFrom}T00:00:00.000Z`) } : {}),
              ...(dateTo ? { lte: new Date(`${dateTo}T23:59:59.999Z`) } : {}),
            },
          }
        : {}),
      ...(q
        ? {
            OR: [
              { event: { contains: q, mode: Prisma.QueryMode.insensitive } },
              { entityType: { contains: q, mode: Prisma.QueryMode.insensitive } },
              { entityId: { contains: q, mode: Prisma.QueryMode.insensitive } },
              { requestId: { contains: q, mode: Prisma.QueryMode.insensitive } },
              { actorUser: { name: { contains: q, mode: Prisma.QueryMode.insensitive } } },
              { actorUser: { email: { contains: q, mode: Prisma.QueryMode.insensitive } } },
            ],
          }
        : {}),
    }

    const [total, items] = await prisma.$transaction([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { [sort]: order },
        include: {
          actorUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
    ])

    const response: ListResponse<AuditLogReportRow> = {
      items: items.map(serialize),
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
    const response = NextResponse.json({ error: "Unable to load audit logs." }, { status: 500 })
    return withRequestId(response, logContext.requestId)
  }
}
