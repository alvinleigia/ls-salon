import { NextResponse } from "next/server"
import { z } from "zod"

import { auth } from "@/auth"
import { toISODate } from "@/lib/date"
import { canManageUsers, type Role } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import {
  normalizeHistoryRangeToPast,
  syncRosterHistoryRange,
} from "@/lib/roster-history"
import type { RosterHistoryDay } from "@/types/shifts"

const querySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  staffIds: z.string().optional(),
})

type RosterHistoryDelegate = {
  findMany: (args: unknown) => Promise<
    Array<{
      staffProfileId: string
      date: Date
      source: RosterHistoryDay["source"]
      templateId: string | null
      templateName: string | null
      startTime: string | null
      endTime: string | null
      paidMinutes: number
      leaveDefinitionCode: string | null
      leaveDefinitionName: string | null
      leaveReason: string | null
    }>
  >
}

const parseDateOnly = (value: string) => {
  const [year, month, day] = value.split("-").map((chunk) => Number(chunk))
  if (!year || !month || !day) return null
  const parsed = new Date(year, month - 1, day)
  parsed.setHours(0, 0, 0, 0)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

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

  const userIds = (staffIds ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
  if (!userIds.length) {
    return NextResponse.json({ items: [] as RosterHistoryDay[] })
  }

  const staffProfiles = await prisma.staffProfile.findMany({
    where: { userId: { in: userIds } },
    select: { id: true, userId: true },
  })
  if (!staffProfiles.length) {
    return NextResponse.json({ items: [] as RosterHistoryDay[] })
  }

  const staffProfileIds = staffProfiles.map((item) => item.id)
  const profileToUser = new Map(staffProfiles.map((item) => [item.id, item.userId]))
  const settings = await prisma.appSetting.findUnique({
    where: { id: "global" },
    select: { timeZone: true },
  })
  const timeZone = settings?.timeZone ?? null

  const normalizedPastRange = normalizeHistoryRangeToPast(startDate, endDate, timeZone)
  if (normalizedPastRange) {
    await syncRosterHistoryRange(prisma, {
      staffProfileIds,
      startDate: normalizedPastRange.startDate,
      endDate: normalizedPastRange.endDate,
      mode: "insert-missing",
    })
  }

  const parsedStart = parseDateOnly(startDate)
  const parsedEnd = parseDateOnly(endDate)
  if (!parsedStart || !parsedEnd) {
    return NextResponse.json(
      { error: "Invalid query parameters." },
      { status: 400 }
    )
  }

  const rosterHistoryDelegate = (
    prisma as { staffRosterHistoryDay?: RosterHistoryDelegate }
  ).staffRosterHistoryDay
  if (!rosterHistoryDelegate) {
    return NextResponse.json({ items: [] as RosterHistoryDay[] })
  }

  const items = await rosterHistoryDelegate.findMany({
    where: {
      staffProfileId: { in: staffProfileIds },
      date: {
        gte: parsedStart,
        lte: parsedEnd,
      },
    },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    select: {
      staffProfileId: true,
      date: true,
      source: true,
      templateId: true,
      templateName: true,
      startTime: true,
      endTime: true,
      paidMinutes: true,
      leaveDefinitionCode: true,
      leaveDefinitionName: true,
      leaveReason: true,
    },
  })

  const response: RosterHistoryDay[] = items
    .map((item) => {
      const staffId = profileToUser.get(item.staffProfileId)
      if (!staffId) return null
      return {
        staffId,
        date: toISODate(item.date),
        source: item.source,
        templateId: item.templateId,
        templateName: item.templateName,
        startTime: item.startTime,
        endTime: item.endTime,
        paidMinutes: item.paidMinutes,
        leaveDefinitionCode: item.leaveDefinitionCode,
        leaveDefinitionName: item.leaveDefinitionName,
        leaveReason: item.leaveReason,
      }
    })
    .filter(Boolean) as RosterHistoryDay[]

  return NextResponse.json({ items: response })
}
