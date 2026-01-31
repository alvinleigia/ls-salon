import { NextResponse } from "next/server"

import { auth } from "@/auth"
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
    staffProfile?: { userId?: string }
    isDefault?: boolean
    startDate?: { gte?: Date; lte?: Date }
    OR?: { name?: { contains: string; mode: "insensitive" } }[]
  } = {}

  if (staffId) {
    where.staffProfile = { userId: staffId }
  }
  if (isDefault) {
    where.isDefault = true
  }

  if (startDate) {
    where.startDate = {
      gte: new Date(`${startDate}T00:00:00.000Z`),
      lte: new Date(`${startDate}T23:59:59.999Z`),
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
      staffProfile: { select: { user: { select: { id: true, name: true, email: true } } } },
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
  const weekOff2Weeks =
    data.weekOffDay2 && (!data.weekOff2Weeks || !data.weekOff2Weeks.length)
      ? [1, 2, 3, 4, 5]
      : data.weekOff2Weeks ?? []
  const staffIds = Array.from(new Set(data.staffIds.map((value) => value.trim())))

  if (!data.isDefault && !staffIds.length) {
    return NextResponse.json({ error: "Select at least one staff member." }, { status: 400 })
  }

  if (data.isDefault) {
    await prisma.shiftSchedule.updateMany({ data: { isDefault: false } })
    const schedule = await prisma.shiftSchedule.create({
      data: {
        name: data.name?.trim() || null,
        staffProfileId: null,
        isDefault: true,
        startDate: new Date(`${data.startDate}T00:00:00.000Z`),
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
        staffProfile: { select: { user: { select: { id: true, name: true, email: true } } } },
      },
    })

    return NextResponse.json({ schedule })
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

  const existingSchedules = await prisma.shiftSchedule.findMany({
    where: { staffProfileId: { in: finalStaffProfiles.map((profile) => profile.id) } },
    select: { staffProfileId: true },
  })
  const existingSet = new Set(existingSchedules.map((item) => item.staffProfileId))
  const targets = finalStaffProfiles.filter((profile) => !existingSet.has(profile.id))

  if (!targets.length) {
    return NextResponse.json(
      { error: "Selected staff already have schedules assigned." },
      { status: 409 }
    )
  }

  const scheduleData = targets.map((profile) => ({
    name: data.name?.trim() || null,
    staffProfileId: profile.id,
    isDefault: false,
    startDate: new Date(`${data.startDate}T00:00:00.000Z`),
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
  }))

  const schedules = await prisma.$transaction(async (tx) => {
    const created: typeof scheduleData = []
    for (const item of scheduleData) {
      const schedule = await tx.shiftSchedule.create({
        data: item,
        include: {
          blocks: {
            orderBy: { sortOrder: "asc" },
            include: { template: { select: { id: true, name: true } } },
          },
          staffProfile: { select: { user: { select: { id: true, name: true, email: true } } } },
        },
      })
      created.push(schedule as typeof scheduleData[number])
    }
    return created
  })

  return NextResponse.json({ schedules, createdCount: schedules.length })
}
