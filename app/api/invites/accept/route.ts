import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"

import {
  createApiLogContext,
  logApiRequestError,
  logApiRequestStart,
  logApiRequestSuccess,
  withRequestId,
} from "@/lib/api-logging"
import { prisma } from "@/lib/prisma"
import { acceptInviteSchema } from "@/lib/validation"
import { resolveTenantFromRequest } from "@/lib/tenancy"

export async function POST(request: Request) {
  const logContext = createApiLogContext(request)
  logApiRequestStart(logContext, request)

  const body = await request.json().catch(() => null)
  if (!body) {
    const response = NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
    logApiRequestSuccess(logContext, 400, { reason: "invalid_json" })
    return withRequestId(response, logContext.requestId)
  }

  const parsed = acceptInviteSchema.safeParse(body)
  if (!parsed.success) {
    const response = NextResponse.json(
      { error: "Invalid input.", details: parsed.error.flatten() },
      { status: 400 }
    )
    logApiRequestSuccess(logContext, 400, { reason: "validation_failed" })
    return withRequestId(response, logContext.requestId)
  }

  try {
    const { token, name, password } = parsed.data
    const tenant = await resolveTenantFromRequest(request)
    if (!tenant) {
      const response = NextResponse.json({ error: "Tenant not found." }, { status: 404 })
      logApiRequestSuccess(logContext, 404, { reason: "tenant_not_found" })
      return withRequestId(response, logContext.requestId)
    }

    const invite = await prisma.invitation.findFirst({ where: { token, tenantId: tenant.id } })
    if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
      const response = NextResponse.json(
        { error: "Invite is invalid or expired." },
        { status: 400 }
      )
      logApiRequestSuccess(logContext, 400, { reason: "invalid_or_expired_invite" })
      return withRequestId(response, logContext.requestId)
    }

    const passwordHash = await bcrypt.hash(password, 10)

    const existing = await prisma.user.findFirst({
      where: { email: invite.email, tenantId: tenant.id },
    })
    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          name: name || existing.name,
          passwordHash,
          role: invite.role,
        },
      })
    } else {
      await prisma.user.create({
        data: {
          tenantId: tenant.id,
          name: name || undefined,
          email: invite.email,
          passwordHash,
          role: invite.role,
        },
      })
    }

    await prisma.invitation.update({
      where: { token },
      data: { acceptedAt: new Date() },
    })

    const response = NextResponse.json({ ok: true })
    logApiRequestSuccess(logContext, 200, { result: "invite_accepted" })
    return withRequestId(response, logContext.requestId)
  } catch (error) {
    logApiRequestError(logContext, error, 500)
    const response = NextResponse.json({ error: "Unable to accept invitation." }, { status: 500 })
    return withRequestId(response, logContext.requestId)
  }
}
