import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { canInvite, type Role } from "@/lib/permissions"

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await auth()
  const role = (session?.user as { role?: string })?.role

  if (!session?.user || !canInvite(role as Role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  await prisma.invitation.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
