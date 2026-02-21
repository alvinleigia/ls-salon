import { NextResponse } from "next/server"

import { auth } from "@/auth"
import {
  createApiLogContext,
  logApiRequestError,
  logApiRequestStart,
  logApiRequestSuccess,
  withRequestId,
} from "@/lib/api-logging"
import { prisma } from "@/lib/prisma"
import { canInvite, type Role } from "@/lib/permissions"

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const logContext = createApiLogContext(request)
  logApiRequestStart(logContext, request)

  const { id } = await params
  const session = await auth()
  const role = (session?.user as { role?: string })?.role

  if (!session?.user || !canInvite(role as Role)) {
    const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    logApiRequestSuccess(logContext, 401, { reason: "unauthorized", inviteId: id })
    return withRequestId(response, logContext.requestId)
  }

  try {
    await prisma.invitation.delete({ where: { id } })
    const response = NextResponse.json({ ok: true })
    logApiRequestSuccess(logContext, 200, { inviteId: id, result: "deleted" })
    return withRequestId(response, logContext.requestId)
  } catch (error) {
    logApiRequestError(logContext, error, 500, { inviteId: id })
    const response = NextResponse.json({ error: "Unable to delete invitation." }, { status: 500 })
    return withRequestId(response, logContext.requestId)
  }
}
