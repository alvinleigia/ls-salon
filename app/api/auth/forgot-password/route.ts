import { NextResponse } from "next/server"
import crypto from "crypto"

import {
  createApiLogContext,
  logApiRequestError,
  logApiRequestStart,
  logApiRequestSuccess,
  withRequestId,
} from "@/lib/api-logging"
import { enterTenantDbContext, prisma } from "@/lib/prisma"
import { forgotPasswordSchema } from "@/lib/validation"
import { mailer, mailFrom } from "@/lib/mailer"
import { resetPasswordEmail } from "@/lib/emails/reset-password"
import { resolveTenantFromRequest } from "@/lib/tenancy"

export const runtime = "nodejs"

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000
const RATE_LIMIT_MAX = 5
const rateLimitStore = new Map<string, number[]>()

const getClientIp = (request: Request) => {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0]?.trim()
  return request.headers.get("x-real-ip") ?? "unknown"
}

const isRateLimited = (key: string) => {
  const now = Date.now()
  const hits = rateLimitStore.get(key) ?? []
  const recent = hits.filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS)
  if (recent.length >= RATE_LIMIT_MAX) {
    rateLimitStore.set(key, recent)
    return true
  }
  recent.push(now)
  rateLimitStore.set(key, recent)
  return false
}

export async function POST(request: Request) {
  const logContext = createApiLogContext(request)
  logApiRequestStart(logContext, request)

  const body = await request.json().catch(() => ({}))
  const parsed = forgotPasswordSchema.safeParse(body)
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

    const { email } = parsed.data
    const ip = getClientIp(request)
    const rateKey = `${ip}:${email.toLowerCase()}`
    if (isRateLimited(rateKey)) {
      const response = NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      )
      logApiRequestSuccess(logContext, 429, { reason: "rate_limited" })
      return withRequestId(response, logContext.requestId)
    }

    const user = await prisma.user.findFirst({ where: { email, tenantId: tenant.id } })
    if (!user) {
      const response = NextResponse.json({ ok: true })
      logApiRequestSuccess(logContext, 200, { result: "masked_user_not_found" })
      return withRequestId(response, logContext.requestId)
    }

    if (!mailFrom) {
      const response = NextResponse.json(
        { error: "Email service not configured." },
        { status: 500 }
      )
      logApiRequestSuccess(logContext, 500, { reason: "mailer_not_configured" })
      return withRequestId(response, logContext.requestId)
    }

    const rawToken = crypto.randomBytes(32).toString("hex")
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex")
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60)

    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } })
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    })

    const resetUrl = new URL(`/auth/reset-password?token=${rawToken}`, request.url).toString()
    const emailTemplate = resetPasswordEmail({ resetUrl })

    await mailer.sendMail({
      from: mailFrom,
      to: user.email,
      subject: emailTemplate.subject,
      text: emailTemplate.text,
      html: emailTemplate.html,
    })

    const response = NextResponse.json({ ok: true })
    logApiRequestSuccess(logContext, 200, { result: "reset_sent" })
    return withRequestId(response, logContext.requestId)
  } catch (error) {
    logApiRequestError(logContext, error, 500)
    const response = NextResponse.json({ error: "Unable to process request." }, { status: 500 })
    return withRequestId(response, logContext.requestId)
  }
}
