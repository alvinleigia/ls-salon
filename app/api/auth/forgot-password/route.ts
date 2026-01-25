import { NextResponse } from "next/server"
import crypto from "crypto"

import { prisma } from "@/lib/prisma"
import { forgotPasswordSchema } from "@/lib/validation"
import { mailer, mailFrom } from "@/lib/mailer"
import { resetPasswordEmail } from "@/lib/emails/reset-password"

export const runtime = "nodejs"

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.APP_URL ||
  "http://localhost:3000"

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
  const body = await request.json().catch(() => ({}))
  const parsed = forgotPasswordSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { email } = parsed.data
  const ip = getClientIp(request)
  const rateKey = `${ip}:${email.toLowerCase()}`
  if (isRateLimited(rateKey)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    )
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    return NextResponse.json({ ok: true })
  }

  if (!mailFrom) {
    return NextResponse.json(
      { error: "Email service not configured." },
      { status: 500 }
    )
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

  const resetUrl = `${APP_URL}/auth/reset-password?token=${rawToken}`
  const emailTemplate = resetPasswordEmail({ resetUrl })

  await mailer.sendMail({
    from: mailFrom,
    to: user.email,
    subject: emailTemplate.subject,
    text: emailTemplate.text,
    html: emailTemplate.html,
  })

  return NextResponse.json({ ok: true })
}
