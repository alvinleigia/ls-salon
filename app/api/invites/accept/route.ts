import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"

import { prisma } from "@/lib/prisma"
import { acceptInviteSchema } from "@/lib/validation"

export async function POST(request: Request) {
  const body = await request.json()
  const parsed = acceptInviteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { token, name, password } = parsed.data

  const invite = await prisma.invitation.findUnique({ where: { token } })
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
    return NextResponse.json(
      { error: "Invite is invalid or expired." },
      { status: 400 }
    )
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

  return NextResponse.json({ ok: true })
}
