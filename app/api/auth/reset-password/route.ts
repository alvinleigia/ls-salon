import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import crypto from "crypto"

import {
  createApiLogContext,
  logApiRequestError,
  logApiRequestStart,
  logApiRequestSuccess,
  withRequestId,
} from "@/lib/api-logging"
import { enterTenantDbContext, prisma } from "@/lib/prisma"
import { resetPasswordSchema } from "@/lib/validation"
import { resolveTenantFromRequest } from "@/lib/tenancy"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const logContext = createApiLogContext(request)
  logApiRequestStart(logContext, request)

  const body = await request.json().catch(() => ({}))
  const parsed = resetPasswordSchema.safeParse(body)
  if (!parsed.success) {
    const response = NextResponse.json(
      { error: "Invalid input.", details: parsed.error.flatten() },
      { status: 400 }
    )
    logApiRequestSuccess(logContext, 400, { reason: "validation_failed" })
    return withRequestId(response, logContext.requestId)
  }

  try {
    const tenant = await resolveTenantFromRequest(request)
    if (!tenant) {
      const response = NextResponse.json({ error: "Tenant not found." }, { status: 404 })
      logApiRequestSuccess(logContext, 404, { reason: "tenant_not_found" })
      return withRequestId(response, logContext.requestId)
    }
    enterTenantDbContext(tenant.id)

    const { token, password } = parsed.data
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex")

    const resetToken = await prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: {
          select: {
            tenantId: true,
          },
        },
      },
    })

    if (!resetToken || resetToken.user.tenantId !== tenant.id) {
      const response = NextResponse.json(
        { error: "This reset link is invalid or expired." },
        { status: 400 }
      )
      logApiRequestSuccess(logContext, 400, { reason: "invalid_or_expired_token" })
      return withRequestId(response, logContext.requestId)
    }

    const passwordHash = await bcrypt.hash(password, 10)

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      prisma.passwordResetToken.deleteMany({
        where: { userId: resetToken.userId, usedAt: { not: null } },
      }),
    ])

    const response = NextResponse.json({ ok: true })
    logApiRequestSuccess(logContext, 200, { result: "password_reset_success" })
    return withRequestId(response, logContext.requestId)
  } catch (error) {
    logApiRequestError(logContext, error, 500)
    const response = NextResponse.json({ error: "Unable to reset password." }, { status: 500 })
    return withRequestId(response, logContext.requestId)
  }
}
