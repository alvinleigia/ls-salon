import { NextResponse } from "next/server"
import { z } from "zod"

import { auth } from "@/auth"
import { canManageUsers, type Role } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import type { LeaveRosterItem } from "@/types/leaves"

const querySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  staffIds: z.string().optional(),
})

export async function GET(request: Request) {
  const session = await auth()
  const role = (session?.user as { role?: string })?.role as Role | undefined
  if (!session?.user || !canManageUsers(role ?? null)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const parsed = querySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams.entries())
  )
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query parameters.", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { startDate, endDate, staffIds } = parsed.data
  if (startDate > endDate) {
    return NextResponse.json(
      { error: "Start date cannot be after end date." },
      { status: 400 }
    )
  }

  const staffUserIds = (staffIds ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
  const staffProfiles = staffUserIds.length
    ? await prisma.staffProfile.findMany({
        where: { userId: { in: staffUserIds } },
        select: { id: true },
      })
    : []
  const staffProfileIds = staffProfiles.map((profile) => profile.id)

  const items = await prisma.leaveRequest.findMany({
    where: {
      status: "APPROVED",
      startDate: { lte: new Date(`${endDate}T00:00:00.000Z`) },
      endDate: { gte: new Date(`${startDate}T00:00:00.000Z`) },
      ...(staffProfileIds.length ? { staffProfileId: { in: staffProfileIds } } : {}),
    },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      reason: true,
      leaveDefinition: {
        select: {
          code: true,
          name: true,
        },
      },
      staffProfile: {
        select: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
    orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
  })

  const response: LeaveRosterItem[] = items.map((item) => ({
    id: item.id,
    staffId: item.staffProfile.user.id,
    staffName: item.staffProfile.user.name,
    staffEmail: item.staffProfile.user.email,
    leaveDefinitionCode: item.leaveDefinition.code,
    leaveDefinitionName: item.leaveDefinition.name,
    startDate: item.startDate.toISOString(),
    endDate: item.endDate.toISOString(),
    reason: item.reason,
  }))

  return NextResponse.json({ items: response })
}
