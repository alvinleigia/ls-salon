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
  if (data.staffIds.length !== 1) {
    return NextResponse.json(
      { error: "Select exactly one staff member when editing a schedule." },
      { status: 400 }
    )
  }
  const weekOff2Weeks =
    data.weekOffDay2 && (!data.weekOff2Weeks || !data.weekOff2Weeks.length)
      ? [1, 2, 3, 4, 5]
      : data.weekOff2Weeks ?? []
  let staffProfile = await prisma.staffProfile.findUnique({
    where: { userId: data.staffIds[0] },
    select: { id: true },
  })

  if (!staffProfile) {
    const user = await prisma.user.findUnique({
      where: { id: data.staffIds[0] },
      select: { role: true },
    })
    if (user?.role === "STAFF") {
      staffProfile = await prisma.staffProfile.create({
        data: { userId: data.staffIds[0] },
        select: { id: true },
      })
    }
  }

  if (!staffProfile) {
    return NextResponse.json({ error: "Staff profile not found." }, { status: 404 })
  }

  const existing = await prisma.shiftSchedule.findUnique({
    where: { staffProfileId: staffProfile.id },
    select: { id: true },
  })
  if (existing && existing.id !== id) {
    return NextResponse.json(
      { error: "Staff already has a schedule assigned." },
      { status: 409 }
    )
  }

  const schedule = await prisma.$transaction(async (tx) => {
    const updated = await tx.shiftSchedule.update({
      where: { id },
      data: {
        name: data.name?.trim() || null,
        staffProfileId: staffProfile.id,
        startDate: new Date(`${data.startDate}T00:00:00.000Z`),
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

    return updated
  })

  const withBlocks = await prisma.shiftSchedule.findUnique({
    where: { id: schedule.id },
    include: {
      blocks: {
        orderBy: { sortOrder: "asc" },
        include: { template: { select: { id: true, name: true } } },
      },
      staffProfile: { select: { user: { select: { id: true, name: true, email: true } } } },
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
