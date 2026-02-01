import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { shiftScheduleSchema } from "@/lib/validation"
import { canManageUsers, type Role } from "@/lib/permissions"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
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
  let schedule = null as Awaited<ReturnType<typeof prisma.shiftSchedule.update>> | null

  if (data.isDefault) {
    await prisma.shiftSchedule.updateMany({ data: { isDefault: false } })
    schedule = await prisma.$transaction(async (tx) => {
      const updated = await tx.shiftSchedule.update({
        where: { id },
        data: {
          name: data.name?.trim() || null,
          isDefault: true,
          startDate: new Date(data.startDate),
          weekOffDay1: data.weekOffDay1,
          weekOffDay2: data.weekOffDay2 ? data.weekOffDay2 : null,
          weekOff2Weeks,
        },
      })

      await tx.shiftScheduleBlock.deleteMany({ where: { scheduleId: id } })
      if (data.blocks.length) {
        await tx.shiftScheduleBlock.createMany({
          data: data.blocks.map((block, index) => ({
            scheduleId: id,
            templateId: block.templateId,
            repeatDays: block.repeatDays,
            sortOrder: block.sortOrder ?? index,
          })),
        })
      }

      await tx.staffScheduleAssignment.deleteMany({ where: { scheduleId: id } })

      return updated
    })
  } else {
    const staffIds = Array.from(new Set(data.staffIds.map((value) => value.trim())))
    if (!staffIds.length) {
      return NextResponse.json(
        { error: "Select at least one staff member." },
        { status: 400 }
      )
    }

    const staffProfiles = await prisma.staffProfile.findMany({
      where: { userId: { in: staffIds } },
      select: { id: true, userId: true },
    })

    const staffProfilesMap = new Map(staffProfiles.map((profile) => [profile.userId, profile]))
    const missingStaffIds = staffIds.filter((staffId) => !staffProfilesMap.has(staffId))

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
      .map((staffId) => staffProfilesMap.get(staffId))
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
        scheduleId: { not: id },
        ...(assignmentEnd ? { startDate: { lte: assignmentEnd } } : {}),
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

    schedule = await prisma.$transaction(async (tx) => {
      const updated = await tx.shiftSchedule.update({
        where: { id },
        data: {
          name: data.name?.trim() || null,
          isDefault: false,
          startDate: new Date(data.startDate),
          weekOffDay1: data.weekOffDay1,
          weekOffDay2: data.weekOffDay2 ? data.weekOffDay2 : null,
          weekOff2Weeks,
        },
      })

      await tx.shiftScheduleBlock.deleteMany({ where: { scheduleId: id } })
      if (data.blocks.length) {
        await tx.shiftScheduleBlock.createMany({
          data: data.blocks.map((block, index) => ({
            scheduleId: id,
            templateId: block.templateId,
            repeatDays: block.repeatDays,
            sortOrder: block.sortOrder ?? index,
          })),
        })
      }

      await tx.staffScheduleAssignment.deleteMany({ where: { scheduleId: id } })
      await tx.staffScheduleAssignment.createMany({
        data: finalStaffProfiles.map((profile) => ({
          staffProfileId: profile.id,
          scheduleId: id,
          startDate: assignmentStart,
          endDate: assignmentEnd,
        })),
      })

      return updated
    })
  }

  const withBlocks = await prisma.shiftSchedule.findUnique({
    where: { id: schedule.id },
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

  return NextResponse.json({ schedule: withBlocks })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await auth()
  const role = (session?.user as { role?: string })?.role

  if (!session?.user || !canManageUsers(role as Role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  await prisma.shiftSchedule.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
