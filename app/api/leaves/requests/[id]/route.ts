import { NextResponse } from "next/server"

import { auth } from "@/auth"
import type { Role } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import {
  buildLeaveRequestRuleChecks,
  buildLeaveRequestTimeline,
  leaveRequestSelect,
  serializeLeaveRequest,
} from "../../_requests"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const role = (session?.user as { role?: string })?.role as Role | undefined
  const sessionUserId = (session?.user as { id?: string })?.id
  const isAdmin = role === "ADMIN"
  const isManager = role === "MANAGER"
  const isStaff = role === "STAFF"
  if (!session?.user || (!isAdmin && !isManager && !isStaff)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!sessionUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const includeRuleChecks =
    new URL(request.url).searchParams.get("includeRuleChecks") === "true"
  const item = await prisma.leaveRequest.findUnique({
    where: { id },
    select: leaveRequestSelect,
  })
  if (!item) {
    return NextResponse.json({ error: "Leave request not found." }, { status: 404 })
  }

  const isOwner = item.staffProfile.user.id === sessionUserId
  const isAssignedManager =
    isManager &&
    item.staffProfile.user.role === "STAFF" &&
    item.staffProfile.managerUserId === sessionUserId
  if (!isAdmin && !isOwner && !isAssignedManager) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const serializedItem = serializeLeaveRequest(item)
  if (!includeRuleChecks) {
    return NextResponse.json({ item: serializedItem })
  }

  const leaveDefinition = await prisma.leaveDefinition.findUnique({
    where: { id: item.leaveDefinitionId },
    select: {
      allowedUsers: true,
      minDaysPerRequest: true,
      maxDaysPerRequest: true,
      maxConsecutiveDays: true,
      priorEntryAllowed: true,
      noticeDays: true,
      weekOffSingleSideAllowed: true,
      weekOffBothSideAllowed: true,
      holidaySingleSideAllowed: true,
      holidayBothSideAllowed: true,
    },
  })
  if (!leaveDefinition) {
    return NextResponse.json({ error: "Leave definition not found." }, { status: 404 })
  }

  const staff = await prisma.staffProfile.findUnique({
    where: { id: item.staffProfileId },
    select: {
      user: {
        select: {
          gender: true,
        },
      },
    },
  })

  const ruleChecks = await buildLeaveRequestRuleChecks({
    tx: prisma,
    staffProfileId: item.staffProfileId,
    staffGender: staff?.user.gender ?? null,
    leaveDefinition,
    startDate: item.startDate,
    endDate: item.endDate,
    createdAt: item.createdAt,
  })
  const timeline = buildLeaveRequestTimeline({
    createdAt: item.createdAt,
    staffName: item.staffProfile.user.name,
    staffEmail: item.staffProfile.user.email,
    reviewedAt: item.reviewedAt,
    reviewedByName: item.reviewedByUser?.name ?? null,
    reviewedByEmail: item.reviewedByUser?.email ?? null,
    reviewerComment: item.reviewerComment,
    canceledAt: item.canceledAt,
    cancelReason: item.cancelReason,
  })

  return NextResponse.json({ item: serializedItem, ruleChecks, timeline })
}
