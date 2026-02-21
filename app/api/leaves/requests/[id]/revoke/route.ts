import { NextResponse } from "next/server"

import { auth } from "@/auth"
import type { Role } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import {
  normalizeHistoryRangeToPast,
  syncRosterHistoryRange,
} from "@/lib/roster-history"
import { revokeLeaveRequestSchema } from "@/lib/validation"
import { notifyLeaveRevoked } from "../../../_notifications"
import {
  assertRevokeTransitionAllowed,
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
  const isAdmin = role === "ADMIN"
  const isManager = role === "MANAGER"
  if (!session?.user || (!isAdmin && !isManager)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!sessionUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const payload = await request.json().catch(() => ({}))
  const parsed = revokeLeaveRequestSchema.safeParse(payload)
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
            select: {
              role: true,
            },
          },
        },
      },
    },
  })
  if (!current) {
    return NextResponse.json({ error: "Leave request not found." }, { status: 404 })
  }
  if (
    isManager &&
    (current.staffProfile.user.role !== "STAFF" ||
      current.staffProfile.managerUserId !== sessionUserId)
  ) {
    return NextResponse.json(
      { error: "You can only revoke approved requests for your assigned staff." },
      { status: 403 }
    )
  }

  try {
    assertRevokeTransitionAllowed(current.status)

    const item = await prisma.leaveRequest.update({
      where: { id },
      data: {
        status: "REVOKED",
        revokedAt: new Date(),
        revokedByUserId: sessionUserId,
        revokeReason: parsed.data.revokeReason.trim(),
      },
      select: leaveRequestSelect,
    })

    const serialized = serializeLeaveRequest(item)
    const normalizedPastRange = normalizeHistoryRangeToPast(
      serialized.startDate.slice(0, 10),
      serialized.endDate.slice(0, 10)
    )
    if (normalizedPastRange) {
      await syncRosterHistoryRange(prisma, {
        staffProfileIds: [serialized.staffProfileId],
        startDate: normalizedPastRange.startDate,
        endDate: normalizedPastRange.endDate,
        mode: "replace",
      })
    }

    void notifyLeaveRevoked(prisma, {
      staffUserId: serialized.staff.userId,
      revokedByName:
        (session.user as { name?: string | null })?.name ?? null,
      revokeReason: serialized.revokeReason,
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
    return NextResponse.json({ error: "Unable to revoke leave request." }, { status: 500 })
  }
}

