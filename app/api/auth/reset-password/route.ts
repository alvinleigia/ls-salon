import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import crypto from "crypto"

import { prisma } from "@/lib/prisma"
import { resetPasswordSchema } from "@/lib/validation"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const parsed = resetPasswordSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { token, password } = parsed.data
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex")

  const resetToken = await prisma.passwordResetToken.findFirst({
    where: {
      tokenHash,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  })

  if (!resetToken) {
    return NextResponse.json(
      { error: "This reset link is invalid or expired." },
      { status: 400 }
    )
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

  return NextResponse.json({ ok: true })
}
