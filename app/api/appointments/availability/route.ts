import { NextResponse } from "next/server"
import { AppointmentStatus } from "@prisma/client"
import { z } from "zod"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { canManageUsers, type Role } from "@/lib/permissions"
import type { AppointmentAvailabilityResult } from "@/types/appointments"
import { checkStaffAppointmentAvailability } from "../_availability"

const availabilitySchema = z.object({
  appointmentId: z.string().trim().min(1).optional(),
  customerId: z.string().trim().min(1).optional(),
  serviceId: z.string().trim().min(1),
  staffId: z.string().trim().min(1),
  startAt: z.string().datetime({ offset: true }),
})

const ACTIVE_APPOINTMENT_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.SCHEDULED,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.IN_PROGRESS,
]

export async function POST(request: Request) {
  const session = await auth()
  const role = (session?.user as { role?: string })?.role

  if (!session?.user || !canManageUsers(role as Role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const payload = await request.json()
  const parsed = availabilitySchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { appointmentId, customerId, serviceId, staffId, startAt: startAtRaw } = parsed.data

  const startAt = new Date(startAtRaw)
  if (Number.isNaN(startAt.getTime())) {
    return NextResponse.json({ available: false, reason: "Invalid appointment date/time." })
  }
  if (startAt <= new Date()) {
    return NextResponse.json({ available: false, reason: "Cannot book appointments in the past." })
  }

  const [staffProfile, service, customer] = await Promise.all([
    prisma.staffProfile.findFirst({
      where: { userId: staffId, user: { role: "STAFF", status: "ACTIVE" } },
      select: { id: true },
    }),
    prisma.service.findUnique({
      where: { id: serviceId },
      select: { id: true, durationMinutes: true, status: true },
    }),
    customerId
      ? prisma.user.findUnique({
          where: { id: customerId },
          select: { id: true, role: true, status: true },
        })
      : Promise.resolve(null),
  ])

  if (!staffProfile) {
    return NextResponse.json({ available: false, reason: "Staff member is not available." })
  }
  if (!service || service.status !== "ACTIVE") {
    return NextResponse.json({ available: false, reason: "Service is not active." })
  }
  if (customerId) {
    if (!customer || customer.role !== "CUSTOMER" || customer.status !== "ACTIVE") {
      return NextResponse.json({ available: false, reason: "Customer is not active." })
    }
  }

  const endAt = new Date(startAt)
  endAt.setMinutes(endAt.getMinutes() + service.durationMinutes)

  const staffShiftAvailability = await checkStaffAppointmentAvailability(
    staffProfile.id,
    startAt,
    endAt
  )
  if (!staffShiftAvailability.ok) {
    const result: AppointmentAvailabilityResult = {
      available: false,
      reason: staffShiftAvailability.reason,
    }
    return NextResponse.json(result)
  }

  const staffConflict = await prisma.appointment.findFirst({
    where: {
      id: appointmentId ? { not: appointmentId } : undefined,
      staffProfileId: staffProfile.id,
      status: { in: ACTIVE_APPOINTMENT_STATUSES },
      startAt: { lt: endAt },
      endAt: { gt: startAt },
    },
    select: { id: true },
  })
  if (staffConflict) {
    return NextResponse.json({
      available: false,
      reason: "Staff member already has an appointment in this time range.",
    } satisfies AppointmentAvailabilityResult)
  }

  if (customerId) {
    const customerConflict = await prisma.appointment.findFirst({
      where: {
        id: appointmentId ? { not: appointmentId } : undefined,
        customerId,
        status: { in: ACTIVE_APPOINTMENT_STATUSES },
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
      select: { id: true },
    })
    if (customerConflict) {
      return NextResponse.json({
        available: false,
        reason: "Customer already has an appointment in this time range.",
      } satisfies AppointmentAvailabilityResult)
    }
  }

  return NextResponse.json({ available: true } satisfies AppointmentAvailabilityResult)
}

