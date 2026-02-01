import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { canManageUsers, type Role } from "@/lib/permissions"

export async function GET(request: Request) {
  const session = await auth()
  const role = (session?.user as { role?: string })?.role

  if (!session?.user || !canManageUsers(role as Role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  const searchParams = url.searchParams
  const staffIdsParam = searchParams.get("staffIds")?.trim()
  const startDate = searchParams.get("startDate")?.trim()
  const endDate = searchParams.get("endDate")?.trim()

  if (!startDate || !endDate) {
    return NextResponse.json({ error: "Start and end dates are required." }, { status: 400 })
  }

  const staffIds = staffIdsParam
    ? staffIdsParam.split(",").map((value) => value.trim()).filter(Boolean)
    : []

  const staffProfiles = staffIds.length
    ? await prisma.staffProfile.findMany({
        where: { userId: { in: staffIds } },
        select: { id: true, userId: true },
      })
    : []

  const staffProfileIds = staffProfiles.map((profile) => profile.id)
  const staffProfileMap = new Map(staffProfiles.map((profile) => [profile.id, profile.userId]))

  const rangeStart = new Date(startDate)
  const rangeEnd = new Date(endDate)

  const assignments = await prisma.staffScheduleAssignment.findMany({
    where: {
      ...(staffProfileIds.length ? { staffProfileId: { in: staffProfileIds } } : {}),
      startDate: { lte: rangeEnd },
      OR: [{ endDate: null }, { endDate: { gte: rangeStart } }],
    },
    include: {
      schedule: {
        include: {
          blocks: {
            orderBy: { sortOrder: "asc" },
            include: { template: { select: { id: true, name: true } } },
          },
        },
      },
    },
    orderBy: { startDate: "asc" },
  })

  const items = assignments.map((assignment) => ({
    ...assignment,
    staffId: staffProfileMap.get(assignment.staffProfileId) ?? null,
  }))

  return NextResponse.json({ items })
}
