import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { canManageUsers, type Role } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { cancelLeaveRequestSchema } from "@/lib/validation"
import {
  assertCancelTransitionAllowed,
  leaveRequestSelect,
  serializeLeaveRequest,
} from "../../../_requests"

export async function PATCH(
  request: Request,
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

  const payload = await request.json().catch(() => ({}))
  const parsed = cancelLeaveRequestSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { id } = await params
  const current = await prisma.leaveRequest.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      staffProfile: {
        select: {
          userId: true,
        },
      },
    },
  })
  if (!current) {
    return NextResponse.json({ error: "Leave request not found." }, { status: 404 })
  }

  const isOwner = current.staffProfile.userId === sessionUserId
  if (!isManager && !isOwner) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    assertCancelTransitionAllowed(current.status)

    const item = await prisma.leaveRequest.update({
      where: { id },
      data: {
        status: "CANCELED",
        canceledAt: new Date(),
        cancelReason: parsed.data.cancelReason?.trim() || null,
      },
      select: leaveRequestSelect,
    })

    return NextResponse.json({ item: serializeLeaveRequest(item) })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "Unable to cancel leave request." }, { status: 500 })
  }
}
