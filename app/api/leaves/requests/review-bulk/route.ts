import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { canManageUsers, type Role } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { bulkReviewLeaveRequestsSchema } from "@/lib/validation"
import { notifyLeaveReviewed } from "../../_notifications"
import { leaveRequestSelect, serializeLeaveRequest } from "../../_requests"

export async function POST(request: Request) {
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
  const parsed = bulkReviewLeaveRequestsSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { requestIds, status, reviewerComment } = parsed.data
  const now = new Date()
  const currentItems = await prisma.leaveRequest.findMany({
    where: { id: { in: requestIds } },
    select: { id: true, status: true },
  })
  const pendingIds = currentItems.filter((item) => item.status === "PENDING").map((item) => item.id)
  const skippedIds = requestIds.filter((id) => !pendingIds.includes(id))

  if (pendingIds.length === 0) {
    return NextResponse.json({
      items: [],
      updatedCount: 0,
      skippedCount: skippedIds.length,
      skippedIds,
    })
  }

  await prisma.leaveRequest.updateMany({
    where: { id: { in: pendingIds }, status: "PENDING" },
    data: {
      status,
      reviewedByUserId: sessionUserId,
      reviewedAt: now,
      reviewerComment: reviewerComment?.trim() || null,
    },
  })

  const updatedItems = await prisma.leaveRequest.findMany({
    where: { id: { in: pendingIds } },
    select: leaveRequestSelect,
  })
  const serializedItems = updatedItems.map(serializeLeaveRequest)
  for (const item of serializedItems) {
    void notifyLeaveReviewed(prisma, {
      staffUserId: item.staff.userId,
      status,
      reviewerName: item.reviewedBy?.name ?? null,
      reviewerComment: item.reviewerComment,
      leaveCode: item.leaveDefinition.code,
      leaveName: item.leaveDefinition.name,
      startDateIso: item.startDate.slice(0, 10),
      endDateIso: item.endDate.slice(0, 10),
      daysCount: item.daysCount,
    })
  }

  return NextResponse.json({
    items: serializedItems,
    updatedCount: serializedItems.length,
    skippedCount: skippedIds.length,
    skippedIds,
  })
}
