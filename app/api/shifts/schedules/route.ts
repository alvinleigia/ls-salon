import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { shiftScheduleSchema } from "@/lib/validation"
import { canManageUsers, type Role } from "@/lib/permissions"
import type { ListResponse } from "@/types/api"

export async function GET(request: Request) {
  const session = await auth()
  const role = (session?.user as { role?: string })?.role

  if (!session?.user || !canManageUsers(role as Role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  const searchParams = url.searchParams
  const q = searchParams.get("q")?.trim()
  const staffId = searchParams.get("staffId")?.trim()
  const isDefault = searchParams.get("isDefault") === "true"
  const startDate = searchParams.get("startDate")?.trim()
  const sort = searchParams.get("sort") ?? "startDate"
  const order = searchParams.get("order") === "desc" ? "desc" : "asc"
  const pageParamRaw = searchParams.get("page")
  const pageSizeParamRaw = searchParams.get("pageSize")
  const hasPagination = pageParamRaw !== null && pageSizeParamRaw !== null
  const pageParam = hasPagination ? Number(pageParamRaw) : NaN
  const pageSizeParam = hasPagination ? Number(pageSizeParamRaw) : NaN
  const page = hasPagination ? Math.max(1, pageParam) : 1
  const pageSize = hasPagination ? Math.max(1, pageSizeParam) : undefined

  const where: {
    isDefault?: boolean
    startDate?: { gte?: Date; lte?: Date }
    assignments?: { some?: { staffProfile?: { userId?: string } } }
    OR?: { name?: { contains: string; mode: "insensitive" } }[]
  } = {}
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

  const orderBy =
    sort === "createdAt" || sort === "updatedAt" || sort === "startDate"
      ? { [sort]: order }
      : { startDate: "asc" }

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

  return NextResponse.json(response)
}

export async function POST(request: Request) {
  const session = await auth()
  const role = (session?.user as { role?: string })?.role

  if (!session?.user || !canManageUsers(role as Role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const parsed = shiftScheduleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const data = parsed.data
  const today = new Date().toISOString().slice(0, 10)
  if (data.startDate < today) {
    return NextResponse.json(
      { error: "Schedule start date cannot be in the past." },
      { status: 400 }
    )
  }
  if (data.assignmentStartDate && data.assignmentStartDate < today) {
    return NextResponse.json(
      { error: "Assignment start date cannot be in the past." },
      { status: 400 }
    )
  }
  const weekOff2Weeks =
    data.weekOffDay2 && (!data.weekOff2Weeks || !data.weekOff2Weeks.length)
      ? [1, 2, 3, 4, 5]
      : data.weekOff2Weeks ?? []
  const staffIds = Array.from(new Set(data.staffIds.map((value) => value.trim())))

  if (data.isDefault) {
    try {
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

      return NextResponse.json({ schedule })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return NextResponse.json(
          { error: "A default schedule already exists." },
          { status: 409 }
        )
      }
      throw error
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
    return NextResponse.json({ error: "Staff profile not found." }, { status: 404 })
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
    return NextResponse.json(
      { error: "Selected staff already have schedules assigned in this range." },
      { status: 409 }
    )
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

  return NextResponse.json({ schedule })
}
