import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { canManageUsers, type Role } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { reviewLeaveRequestSchema } from "@/lib/validation"
import { notifyLeaveReviewed } from "../../../_notifications"
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
  const sessionUserEmail = (session?.user as { email?: string })?.email?.trim().toLowerCase()
  if (!session?.user || !canManageUsers(role ?? null)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!sessionUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const reviewerById = await prisma.user.findUnique({
    where: { id: sessionUserId },
    select: { id: true },
  })
  const reviewer =
    reviewerById ??
    (sessionUserEmail
      ? await prisma.user.findUnique({
          where: { email: sessionUserEmail },
          select: { id: true },
        })
      : null)
  if (!reviewer) {
    return NextResponse.json(
      { error: "Session user not found. Please sign in again." },
      { status: 401 }
    )
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
    select: {
      id: true,
      status: true,
      staffProfile: {
        select: {
          managerUserId: true,
          user: {
            select: { role: true },
          },
        },
      },
    },
  })
  if (!current) {
    return NextResponse.json({ error: "Leave request not found." }, { status: 404 })
  }
  if (role === "MANAGER" && current.staffProfile.user.role !== "STAFF") {
    return NextResponse.json(
      { error: "Managers can only review staff leave requests." },
      { status: 403 }
    )
  }
  if (role === "MANAGER" && current.staffProfile.managerUserId !== reviewer.id) {
    return NextResponse.json(
      { error: "You can only review requests for your assigned staff." },
      { status: 403 }
    )
  }

  try {
    assertReviewTransitionAllowed(current.status)

    const item = await prisma.leaveRequest.update({
      where: { id },
      data: {
        status: parsed.data.status,
        reviewedByUserId: reviewer.id,
        reviewedAt: new Date(),
        reviewerComment: parsed.data.reviewerComment?.trim() || null,
      },
      select: leaveRequestSelect,
    })

    const serialized = serializeLeaveRequest(item)
    void notifyLeaveReviewed(prisma, {
      staffUserId: serialized.staff.userId,
      status: parsed.data.status,
      reviewerName: serialized.reviewedBy?.name ?? null,
      reviewerComment: serialized.reviewerComment,
      leaveCode: serialized.leaveDefinition.code,
      leaveName: serialized.leaveDefinition.name,
      startDateIso: serialized.startDate.slice(0, 10),
      endDateIso: serialized.endDate.slice(0, 10),
      daysCount: serialized.daysCount,
    })

    return NextResponse.json({ item: serialized })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "Unable to review leave request." }, { status: 500 })
  }
}
