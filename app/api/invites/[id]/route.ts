import { NextResponse } from "next/server"

import {
  createApiLogContext,
  logApiRequestError,
  logApiRequestStart,
  logApiRequestSuccess,
  withRequestId,
} from "@/lib/api-logging"
import { prisma } from "@/lib/prisma"
import { canInvite, type Role } from "@/lib/permissions"
import { requireTenantSession } from "@/lib/tenant-auth"

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const logContext = createApiLogContext(request)
  logApiRequestStart(logContext, request)

  const { id } = await params
  const tenantSession = await requireTenantSession(request)
  if (tenantSession.error) {
    logApiRequestSuccess(logContext, tenantSession.error.status, { reason: "tenant_or_auth_failed", inviteId: id })
    return withRequestId(tenantSession.error, logContext.requestId)
  }
  const { tenantId, role } = tenantSession.context

  if (!canInvite(role as Role)) {
    const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    logApiRequestSuccess(logContext, 401, { reason: "unauthorized", inviteId: id })
    return withRequestId(response, logContext.requestId)
  }

  try {
    const deleted = await prisma.invitation.deleteMany({ where: { id, tenantId } })
    if (!deleted.count) {
      const response = NextResponse.json({ error: "Invitation not found." }, { status: 404 })
      logApiRequestSuccess(logContext, 404, { reason: "not_found", inviteId: id })
      return withRequestId(response, logContext.requestId)
    }
    const response = NextResponse.json({ ok: true })
    logApiRequestSuccess(logContext, 200, { inviteId: id, result: "deleted" })
    return withRequestId(response, logContext.requestId)
  } catch (error) {
    logApiRequestError(logContext, error, 500, { inviteId: id })
    const response = NextResponse.json({ error: "Unable to delete invitation." }, { status: 500 })
    return withRequestId(response, logContext.requestId)
  }
}
