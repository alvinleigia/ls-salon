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

    const invite = await prisma.invitation.findUnique({ where: { token } })
    if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
      const response = NextResponse.json(
        { error: "Invite is invalid or expired." },
        { status: 400 }
      )
      logApiRequestSuccess(logContext, 400, { reason: "invalid_or_expired_invite" })
      return withRequestId(response, logContext.requestId)
    }

    const passwordHash = await bcrypt.hash(password, 10)

    const existing = await prisma.user.findUnique({ where: { email: invite.email } })
    if (existing) {
      await prisma.user.update({
        where: { email: invite.email },
        data: {
          name: name || existing.name,
          passwordHash,
          role: invite.role,
        },
      })
    } else {
      await prisma.user.create({
        data: {
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
