import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { canManageUsers, type Role } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { reviewLeaveRequestSchema } from "@/lib/validation"
import {
  assertReviewTransitionAllowed,
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
  if (!session?.user || !canManageUsers(role ?? null)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!sessionUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const payload = await request.json().catch(() => ({}))
  const parsed = reviewLeaveRequestSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { id } = await params
  const current = await prisma.leaveRequest.findUnique({
    where: { id },
    select: { id: true, status: true },
  })
  if (!current) {
    return NextResponse.json({ error: "Leave request not found." }, { status: 404 })
  }

  try {
    assertReviewTransitionAllowed(current.status)

    const item = await prisma.leaveRequest.update({
      where: { id },
      data: {
        status: parsed.data.status,
        reviewedByUserId: sessionUserId,
        reviewedAt: new Date(),
        reviewerComment: parsed.data.reviewerComment?.trim() || null,
      },
      select: leaveRequestSelect,
    })

    return NextResponse.json({ item: serializeLeaveRequest(item) })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "Unable to review leave request." }, { status: 500 })
  }
}
