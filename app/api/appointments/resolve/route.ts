import { NextResponse } from "next/server"

import { AppointmentStatus } from "@prisma/client"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { canManageUsers, type Role } from "@/lib/permissions"
import { appointmentResolveSchema } from "@/lib/validation"
import type { ResolveAppointmentsInput } from "@/types/appointments"

const parseTimeToMinutes = (value: string) => {
  const [hours, minutes] = value.split(":").map((part) => Number(part))
  return (Number.isNaN(hours) ? 0 : hours) * 60 + (Number.isNaN(minutes) ? 0 : minutes)
}

const buildDateTime = (date: string, time: string) => {
  if (!date || !time) return null
  return new Date(`${date}T${time}:00.000Z`)
}

export async function POST(request: Request) {
  const session = await auth()
  const role = (session?.user as { role?: string })?.role

  if (!session?.user || !canManageUsers(role as Role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const payload = await request.json()
  const parsed = appointmentResolveSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request.", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const body: ResolveAppointmentsInput = parsed.data
  const appointmentIds = body.appointmentIds
  if (!appointmentIds.length || !body.action) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 })
  }

  if (body.action === "cancel") {
    const result = await prisma.appointment.updateMany({
      where: { id: { in: appointmentIds } },
      data: { status: AppointmentStatus.CANCELED },
    })
    return NextResponse.json({ updatedCount: result.count })
  }

  if (body.action === "reassign") {
    if (!body.targetStaffId) {
      return NextResponse.json({ error: "Target staff is required." }, { status: 400 })
    }
    const staffProfile = await prisma.staffProfile.findFirst({
      where: { userId: body.targetStaffId },
      select: { id: true },
    })
    if (!staffProfile) {
      return NextResponse.json({ error: "Target staff profile not found." }, { status: 404 })
    }
    const result = await prisma.appointment.updateMany({
      where: { id: { in: appointmentIds } },
      data: { staffProfileId: staffProfile.id },
    })
    return NextResponse.json({ updatedCount: result.count })
  }

  if (body.action === "reschedule") {
    if (!body.rescheduleDate || !body.rescheduleTime) {
      return NextResponse.json({ error: "Reschedule date and time are required." }, { status: 400 })
    }
    const nextStart = buildDateTime(body.rescheduleDate, body.rescheduleTime)
    if (!nextStart || Number.isNaN(nextStart.getTime())) {
      return NextResponse.json({ error: "Invalid reschedule date/time." }, { status: 400 })
    }

    const appointments = await prisma.appointment.findMany({
      where: { id: { in: appointmentIds } },
      select: { id: true, startAt: true, endAt: true },
    })

    const updates = appointments.map((appointment) => {
      const durationMinutes = Math.max(
        1,
        Math.round((appointment.endAt.getTime() - appointment.startAt.getTime()) / 60000)
      )
      const endAt = new Date(nextStart)
      endAt.setMinutes(endAt.getMinutes() + durationMinutes)
      return prisma.appointment.update({
        where: { id: appointment.id },
        data: { startAt: nextStart, endAt },
      })
    })

    await prisma.$transaction(updates)
    return NextResponse.json({ updatedCount: updates.length })
  }

  return NextResponse.json({ error: "Unsupported action." }, { status: 400 })
}
