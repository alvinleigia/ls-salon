import { NextResponse } from "next/server"

import { auth } from "@/auth"
import {
  createApiLogContext,
  logApiRequestError,
  logApiRequestStart,
  logApiRequestSuccess,
  withRequestId,
} from "@/lib/api-logging"
import type { Role } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import {
  normalizeHistoryRangeToPast,
  syncRosterHistoryRange,
} from "@/lib/roster-history"
import { revokeLeaveRequestSchema } from "@/lib/validation"
import { notifyLeaveRevoked } from "../../../_notifications"
import {
  assertRevokeTransitionAllowed,
  leaveRequestSelect,
  serializeLeaveRequest,
} from "../../../_requests"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const logContext = createApiLogContext(request)
  logApiRequestStart(logContext, request)

  const session = await auth()
  const role = (session?.user as { role?: string })?.role as Role | undefined
  const sessionUserId = (session?.user as { id?: string })?.id
  const isAdmin = role === "ADMIN"
  const isManager = role === "MANAGER"
  if (!session?.user || (!isAdmin && !isManager)) {
    const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    logApiRequestSuccess(logContext, 401, { reason: "unauthorized" })
    return withRequestId(response, logContext.requestId)
  }
  if (!sessionUserId) {
    const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    logApiRequestSuccess(logContext, 401, { reason: "missing_session_user_id" })
    return withRequestId(response, logContext.requestId)
  }

  try {
    const payload = await request.json().catch(() => ({}))
    const parsed = revokeLeaveRequestSchema.safeParse(payload)
    if (!parsed.success) {
      const response = NextResponse.json(
        { error: "Invalid input.", details: parsed.error.flatten() },
        { status: 400 }
      )
      logApiRequestSuccess(logContext, 400, { reason: "validation_failed" })
      return withRequestId(response, logContext.requestId)
    }

    const { id } = await params
    const current = await prisma.leaveRequest.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        staffProfile: {
          select: {
            managerUserId: true,
            user: {
              select: {
                role: true,
              },
            },
          },
        },
      },
    })
    if (!current) {
      const response = NextResponse.json({ error: "Leave request not found." }, { status: 404 })
      logApiRequestSuccess(logContext, 404, { reason: "not_found", itemId: id })
      return withRequestId(response, logContext.requestId)
    }
    if (
      isManager &&
      (current.staffProfile.user.role !== "STAFF" ||
        current.staffProfile.managerUserId !== sessionUserId)
    ) {
      const response = NextResponse.json(
        { error: "You can only revoke approved requests for your assigned staff." },
        { status: 403 }
      )
      logApiRequestSuccess(logContext, 403, { reason: "not_assigned_manager", itemId: id })
      return withRequestId(response, logContext.requestId)
    }

    assertRevokeTransitionAllowed(current.status)

    const item = await prisma.leaveRequest.update({
      where: { id },
      data: {
        status: "REVOKED",
        revokedAt: new Date(),
        revokedByUserId: sessionUserId,
        revokeReason: parsed.data.revokeReason.trim(),
      },
      select: leaveRequestSelect,
    })

    const serialized = serializeLeaveRequest(item)
    const normalizedPastRange = normalizeHistoryRangeToPast(
      serialized.startDate.slice(0, 10),
      serialized.endDate.slice(0, 10)
    )
    if (normalizedPastRange) {
      await syncRosterHistoryRange(prisma, {
        staffProfileIds: [serialized.staffProfileId],
        startDate: normalizedPastRange.startDate,
        endDate: normalizedPastRange.endDate,
        mode: "replace",
      })
    }

    void notifyLeaveRevoked(prisma, {
      staffUserId: serialized.staff.userId,
      revokedByName:
        (session.user as { name?: string | null })?.name ?? null,
      revokeReason: serialized.revokeReason,
      leaveCode: serialized.leaveDefinition.code,
      leaveName: serialized.leaveDefinition.name,
      startDateIso: serialized.startDate.slice(0, 10),
      endDateIso: serialized.endDate.slice(0, 10),
      daysCount: serialized.daysCount,
    })

    const response = NextResponse.json({ item: serialized })
    logApiRequestSuccess(logContext, 200, { itemId: id, status: "REVOKED" })
    return withRequestId(response, logContext.requestId)
  } catch (error) {
    if (error instanceof Error) {
      const response = NextResponse.json({ error: error.message }, { status: 400 })
      logApiRequestSuccess(logContext, 400, { reason: "domain_error", message: error.message })
      return withRequestId(response, logContext.requestId)
    }
    logApiRequestError(logContext, error, 500)
    const response = NextResponse.json({ error: "Unable to revoke leave request." }, { status: 500 })
    return withRequestId(response, logContext.requestId)
  }
}
