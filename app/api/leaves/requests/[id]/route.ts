import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { canManageUsers, type Role } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { leaveRequestSelect, serializeLeaveRequest } from "../../_requests"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const role = (session?.user as { role?: string })?.role as Role | undefined
  const sessionUserId = (session?.user as { id?: string })?.id
  const isManager = canManageUsers(role ?? null)
  const isStaff = role === "STAFF"
  if (!session?.user || (!isManager && !isStaff)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!sessionUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const item = await prisma.leaveRequest.findUnique({
    where: { id },
    select: leaveRequestSelect,
  })
  if (!item) {
    return NextResponse.json({ error: "Leave request not found." }, { status: 404 })
  }

  if (!isManager && item.staffProfile.user.id !== sessionUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  return NextResponse.json({ item: serializeLeaveRequest(item) })
}
