import { NextResponse } from "next/server"

import { auth } from "@/auth"
import {
  createApiLogContext,
  logApiRequestError,
  logApiRequestStart,
  logApiRequestSuccess,
  withRequestId,
} from "@/lib/api-logging"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { toISODate } from "@/lib/date"
import { captureRosterHistoryUpToYesterday } from "@/lib/roster-history"
import { shiftScheduleSchema } from "@/lib/validation"
import { canManageUsers, type Role } from "@/lib/permissions"
import type { ListResponse } from "@/types/api"

export async function GET(request: Request) {
  const logContext = createApiLogContext(request)
  logApiRequestStart(logContext, request)

  const session = await auth()
  const role = (session?.user as { role?: string })?.role

  if (!session?.user || !canManageUsers(role as Role)) {
    const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    logApiRequestSuccess(logContext, 401, { reason: "unauthorized" })
    return withRequestId(response, logContext.requestId)
  }

  try {
    const url = new URL(request.url)
    const searchParams = url.searchParams
    const q = searchParams.get("q")?.trim()
    const staffId = searchParams.get("staffId")?.trim()
    const isDefault = searchParams.get("isDefault") === "true"
    const startDate = searchParams.get("startDate")?.trim()
    const sort = searchParams.get("sort") ?? "startDate"
    const order: Prisma.SortOrder = searchParams.get("order") === "desc" ? "desc" : "asc"
    const pageParamRaw = searchParams.get("page")
    const pageSizeParamRaw = searchParams.get("pageSize")
    const hasPagination = pageParamRaw !== null && pageSizeParamRaw !== null
    const pageParam = hasPagination ? Number(pageParamRaw) : NaN
    const pageSizeParam = hasPagination ? Number(pageSizeParamRaw) : NaN
    const page = hasPagination ? Math.max(1, pageParam) : 1
    const pageSize = hasPagination ? Math.max(1, pageSizeParam) : undefined

    const where: Prisma.ShiftScheduleWhereInput = {}
    if (staffId) {
      where.assignments = { some: { staffProfile: { userId: staffId } } }
    }
    if (isDefault) {
      where.isDefault = true
    }

    if (startDate) {
      where.startDate = {
        gte: new Date(startDate),
        lte: new Date(startDate),
      }
    }

    if (q) {
      where.OR = [{ name: { contains: q, mode: "insensitive" } }]
    }

    let orderBy: Prisma.ShiftScheduleOrderByWithRelationInput
    switch (sort) {
      case "createdAt":
        orderBy = { createdAt: order }
        break
      case "updatedAt":
        orderBy = { updatedAt: order }
        break
      case "startDate":
        orderBy = { startDate: order }
        break
      default:
        orderBy = { startDate: "asc" }
    }

    const total = await prisma.shiftSchedule.count({ where })
    const schedules = await prisma.shiftSchedule.findMany({
      where,
      include: {
        blocks: {
          orderBy: { sortOrder: "asc" },
          include: { template: { select: { id: true, name: true } } },
        },
        assignments: {
          include: { staffProfile: { select: { user: { select: { id: true, name: true, email: true } } } } },
        },
      },
      orderBy,
      skip: pageSize ? (page - 1) * pageSize : undefined,
      take: pageSize ?? undefined,
    })

    const effectivePageSize = pageSize ?? (total || schedules.length || 1)
    const totalPages = Math.max(1, Math.ceil(total / effectivePageSize))
    const response: ListResponse<typeof schedules[number]> = {
      items: schedules,
      page,
      pageSize: effectivePageSize,
      total,
      totalPages,
    }

    const json = NextResponse.json(response)
    logApiRequestSuccess(logContext, 200, { page, pageSize: effectivePageSize, total })
    return withRequestId(json, logContext.requestId)
  } catch (error) {
    logApiRequestError(logContext, error, 500)
    const response = NextResponse.json({ error: "Unable to load shift schedules." }, { status: 500 })
    return withRequestId(response, logContext.requestId)
  }
}

export async function POST(request: Request) {
  const logContext = createApiLogContext(request)
  logApiRequestStart(logContext, request)

  const session = await auth()
  const role = (session?.user as { role?: string })?.role

  if (!session?.user || !canManageUsers(role as Role)) {
    const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    logApiRequestSuccess(logContext, 401, { reason: "unauthorized" })
    return withRequestId(response, logContext.requestId)
  }

  const body = await request.json().catch(() => null)
  if (!body) {
    const response = NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
    logApiRequestSuccess(logContext, 400, { reason: "invalid_json" })
    return withRequestId(response, logContext.requestId)
  }
  const parsed = shiftScheduleSchema.safeParse(body)
  if (!parsed.success) {
    const response = NextResponse.json(
      { error: "Invalid input.", details: parsed.error.flatten() },
      { status: 400 }
    )
    logApiRequestSuccess(logContext, 400, { reason: "validation_failed" })
    return withRequestId(response, logContext.requestId)
  }

  const data = parsed.data
  const today = new Date().toISOString().slice(0, 10)
  if (data.startDate < today) {
    const response = NextResponse.json(
      { error: "Schedule start date cannot be in the past." },
      { status: 400 }
    )
    logApiRequestSuccess(logContext, 400, { reason: "past_schedule_start" })
    return withRequestId(response, logContext.requestId)
  }
  if (data.assignmentStartDate && data.assignmentStartDate < today) {
    const response = NextResponse.json(
      { error: "Assignment start date cannot be in the past." },
      { status: 400 }
    )
    logApiRequestSuccess(logContext, 400, { reason: "past_assignment_start" })
    return withRequestId(response, logContext.requestId)
  }
  const weekOff2Weeks =
    data.weekOffDay2 && (!data.weekOff2Weeks || !data.weekOff2Weeks.length)
      ? [1, 2, 3, 4, 5]
      : data.weekOff2Weeks ?? []
  const staffIds = Array.from(new Set(data.staffIds.map((value) => value.trim())))

  if (data.isDefault) {
    try {
      const [existingDefault, allStaffProfiles] = await Promise.all([
        prisma.shiftSchedule.findFirst({
          where: { isDefault: true },
          select: { id: true, startDate: true },
        }),
        prisma.staffProfile.findMany({ select: { id: true } }),
      ])
      if (existingDefault && allStaffProfiles.length) {
        await captureRosterHistoryUpToYesterday(prisma, {
          staffProfileIds: allStaffProfiles.map((item) => item.id),
          startDate: toISODate(existingDefault.startDate),
        })
      }
      await prisma.shiftSchedule.updateMany({ data: { isDefault: false } })
      const schedule = await prisma.shiftSchedule.create({
        data: {
          name: data.name?.trim() || null,
          isDefault: true,
          startDate: new Date(data.startDate),
          weekOffDay1: data.weekOffDay1,
          weekOffDay2: data.weekOffDay2 ? data.weekOffDay2 : null,
          weekOff2Weeks,
          blocks: {
            create: data.blocks.map((block, index) => ({
              templateId: block.templateId,
              repeatDays: block.repeatDays,
              sortOrder: block.sortOrder ?? index,
            })),
          },
        },
        include: {
          blocks: {
            orderBy: { sortOrder: "asc" },
            include: { template: { select: { id: true, name: true } } },
          },
          assignments: {
            include: { staffProfile: { select: { user: { select: { id: true, name: true, email: true } } } } },
          },
        },
      })

      const response = NextResponse.json({ schedule })
      logApiRequestSuccess(logContext, 200, { scheduleId: schedule.id, isDefault: true })
      return withRequestId(response, logContext.requestId)
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const response = NextResponse.json(
          { error: "A default schedule already exists." },
          { status: 409 }
        )
        logApiRequestSuccess(logContext, 409, { reason: "default_schedule_conflict" })
        return withRequestId(response, logContext.requestId)
      }
      logApiRequestError(logContext, error, 500)
      const response = NextResponse.json({ error: "Unable to create default schedule." }, { status: 500 })
      return withRequestId(response, logContext.requestId)
    }
  }

  const staffProfiles = await prisma.staffProfile.findMany({
    where: { userId: { in: staffIds } },
    select: { id: true, userId: true },
  })

  const staffProfilesMap = new Map(staffProfiles.map((profile) => [profile.userId, profile]))
  const missingStaffIds = staffIds.filter((id) => !staffProfilesMap.has(id))

  if (missingStaffIds.length) {
    const staffUsers = await prisma.user.findMany({
      where: { id: { in: missingStaffIds }, role: "STAFF" },
      select: { id: true },
    })
    if (staffUsers.length) {
      const createdProfiles = await Promise.all(
        staffUsers.map((user) =>
          prisma.staffProfile.create({
            data: { userId: user.id },
            select: { id: true, userId: true },
          })
        )
      )
      for (const profile of createdProfiles) {
        staffProfilesMap.set(profile.userId, profile)
      }
    }
  }

  const finalStaffProfiles = staffIds
    .map((id) => staffProfilesMap.get(id))
    .filter(Boolean) as { id: string; userId: string }[]

  if (!finalStaffProfiles.length) {
    const response = NextResponse.json({ error: "Staff profile not found." }, { status: 404 })
    logApiRequestSuccess(logContext, 404, { reason: "staff_profile_not_found" })
    return withRequestId(response, logContext.requestId)
  }

  const assignmentStart = data.assignmentStartDate
    ? new Date(data.assignmentStartDate)
    : new Date(data.startDate)
  const assignmentEnd = data.assignmentEndDate ? new Date(data.assignmentEndDate) : null

  const existingAssignments = await prisma.staffScheduleAssignment.findMany({
    where: {
      staffProfileId: { in: finalStaffProfiles.map((profile) => profile.id) },
      ...(assignmentEnd
        ? { startDate: { lte: assignmentEnd } }
        : {}),
      OR: [{ endDate: null }, { endDate: { gte: assignmentStart } }],
    },
    select: { staffProfileId: true },
  })

  if (existingAssignments.length) {
    const response = NextResponse.json(
      { error: "Selected staff already have schedules assigned in this range." },
      { status: 409 }
    )
    logApiRequestSuccess(logContext, 409, { reason: "assignment_conflict" })
    return withRequestId(response, logContext.requestId)
  }

  const schedule = await prisma.shiftSchedule.create({
    data: {
      name: data.name?.trim() || null,
      isDefault: false,
      startDate: new Date(data.startDate),
      weekOffDay1: data.weekOffDay1,
      weekOffDay2: data.weekOffDay2 ? data.weekOffDay2 : null,
      weekOff2Weeks,
      blocks: {
        create: data.blocks.map((block, index) => ({
          templateId: block.templateId,
          repeatDays: block.repeatDays,
          sortOrder: block.sortOrder ?? index,
        })),
      },
      assignments: {
        create: finalStaffProfiles.map((profile) => ({
          staffProfileId: profile.id,
          startDate: assignmentStart,
          endDate: assignmentEnd,
        })),
      },
    },
    include: {
      blocks: {
        orderBy: { sortOrder: "asc" },
        include: { template: { select: { id: true, name: true } } },
      },
      assignments: {
        include: { staffProfile: { select: { user: { select: { id: true, name: true, email: true } } } } },
      },
    },
  })

  const response = NextResponse.json({ schedule })
  logApiRequestSuccess(logContext, 200, { scheduleId: schedule.id, isDefault: false })
  return withRequestId(response, logContext.requestId)
}
