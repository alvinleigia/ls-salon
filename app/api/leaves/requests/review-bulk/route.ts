import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { canManageUsers, type Role } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import {
  normalizeHistoryRangeToPast,
  syncRosterHistoryRange,
} from "@/lib/roster-history"
import { bulkReviewLeaveRequestsSchema } from "@/lib/validation"
import { notifyLeaveReviewed } from "../../_notifications"
import { leaveRequestSelect, serializeLeaveRequest } from "../../_requests"

export async function POST(request: Request) {
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
  const pendingIds = currentItems
    .filter((item) => item.status === "PENDING")
    .filter((item) =>
      role === "MANAGER"
        ? item.staffProfile.user.role === "STAFF" && item.staffProfile.managerUserId === reviewer.id
        : true
    )
    .map((item) => item.id)
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
      reviewedByUserId: reviewer.id,
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
    const normalizedPastRange = normalizeHistoryRangeToPast(
      item.startDate.slice(0, 10),
      item.endDate.slice(0, 10)
    )
    if (!normalizedPastRange) continue
    await syncRosterHistoryRange(prisma, {
      staffProfileIds: [item.staffProfileId],
      startDate: normalizedPastRange.startDate,
      endDate: normalizedPastRange.endDate,
      mode: "replace",
    })
  }
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
