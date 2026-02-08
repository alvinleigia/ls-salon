import { NextResponse } from "next/server"
import { AppointmentStatus } from "@prisma/client"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { canManageUsers, type Role } from "@/lib/permissions"
import { appointmentUpdateSchema } from "@/lib/validation"
import type { AppointmentRow } from "@/types/appointments"
import { checkStaffAppointmentAvailability } from "../_availability"

const ACTIVE_APPOINTMENT_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.SCHEDULED,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.IN_PROGRESS,
]

const serializeAppointment = <
  T extends Omit<AppointmentRow, "startAt" | "endAt" | "createdAt" | "updatedAt"> & {
    startAt: Date
    endAt: Date
    createdAt: Date
    updatedAt: Date
  },
>(
  appointment: T
) => ({
  ...appointment,
  startAt: appointment.startAt.toISOString(),
  endAt: appointment.endAt.toISOString(),
  createdAt: appointment.createdAt.toISOString(),
  updatedAt: appointment.updatedAt.toISOString(),
})

const appointmentInclude = {
  customer: { select: { id: true, name: true, email: true } },
  service: { select: { id: true, name: true, durationMinutes: true, priceCents: true } },
  staffProfile: {
    select: {
      id: true,
      user: { select: { id: true, name: true, email: true } },
    },
  },
  orderLine: {
    select: {
      id: true,
      order: { select: { id: true, status: true } },
    },
  },
} as const

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await auth()
  const role = (session?.user as { role?: string })?.role

  if (!session?.user || !canManageUsers(role as Role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: appointmentInclude,
  })

  if (!appointment) {
    return NextResponse.json({ error: "Appointment not found." }, { status: 404 })
  }

  return NextResponse.json({ appointment: serializeAppointment(appointment) })
}

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

  const payload = await request.json()
  const parsed = appointmentUpdateSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const data = parsed.data
  const current = await prisma.appointment.findUnique({
    where: { id },
    include: { service: { select: { id: true, durationMinutes: true, priceCents: true } } },
  })

  if (!current) {
    return NextResponse.json({ error: "Appointment not found." }, { status: 404 })
  }

  const [customer, service, staffProfile] = await Promise.all([
    data.customerId
      ? prisma.user.findUnique({
          where: { id: data.customerId },
          select: { id: true, role: true, status: true },
        })
      : Promise.resolve(null),
    data.serviceId
      ? prisma.service.findUnique({
          where: { id: data.serviceId },
          select: { id: true, status: true, durationMinutes: true },
        })
      : Promise.resolve(null),
    data.staffId
      ? prisma.staffProfile.findFirst({
          where: { userId: data.staffId, user: { role: "STAFF" } },
          select: { id: true, user: { select: { id: true, status: true } } },
        })
      : Promise.resolve(null),
  ])

  if (data.customerId) {
    if (!customer) {
      return NextResponse.json({ error: "Customer not found." }, { status: 404 })
    }
    if (customer.role !== "CUSTOMER") {
      return NextResponse.json({ error: "Selected user is not a customer." }, { status: 400 })
    }
    if (customer.status !== "ACTIVE") {
      return NextResponse.json({ error: "Customer is not active." }, { status: 400 })
    }
  }

  if (data.serviceId) {
    if (!service) {
      return NextResponse.json({ error: "Service not found." }, { status: 404 })
    }
    if (service.status !== "ACTIVE") {
      return NextResponse.json({ error: "Service is not active." }, { status: 400 })
    }
  }

  if (data.staffId) {
    if (!staffProfile) {
      return NextResponse.json({ error: "Staff profile not found." }, { status: 404 })
    }
    if (staffProfile.user.status !== "ACTIVE") {
      return NextResponse.json({ error: "Staff member is not active." }, { status: 400 })
    }
  }

  const nextStartAt = data.startAt ? new Date(data.startAt) : current.startAt
  if (Number.isNaN(nextStartAt.getTime())) {
    return NextResponse.json({ error: "Invalid startAt value." }, { status: 400 })
  }
  if (data.startAt && nextStartAt <= new Date()) {
    return NextResponse.json({ error: "Cannot reschedule to the past." }, { status: 400 })
  }

  const durationMinutes = service?.durationMinutes ?? current.service.durationMinutes
  const nextEndAt = new Date(nextStartAt)
  nextEndAt.setMinutes(nextEndAt.getMinutes() + durationMinutes)

  const nextStaffProfileId = staffProfile?.id ?? current.staffProfileId
  const nextCustomerId = customer?.id ?? current.customerId
  const nextStatus = data.status ?? current.status

  const schedulingChanged =
    Boolean(data.startAt || data.serviceId || data.staffId || data.customerId) &&
    ACTIVE_APPOINTMENT_STATUSES.includes(nextStatus)

  if (schedulingChanged) {
    const availability = await checkStaffAppointmentAvailability(
      nextStaffProfileId,
      nextStartAt,
      nextEndAt
    )
    if (!availability.ok) {
      return NextResponse.json({ error: availability.reason }, { status: 409 })
    }

    const [staffConflict, customerConflict] = await Promise.all([
      prisma.appointment.findFirst({
        where: {
          id: { not: current.id },
          staffProfileId: nextStaffProfileId,
          status: { in: ACTIVE_APPOINTMENT_STATUSES },
          startAt: { lt: nextEndAt },
          endAt: { gt: nextStartAt },
        },
        select: { id: true },
      }),
      prisma.appointment.findFirst({
        where: {
          id: { not: current.id },
          customerId: nextCustomerId,
          status: { in: ACTIVE_APPOINTMENT_STATUSES },
          startAt: { lt: nextEndAt },
          endAt: { gt: nextStartAt },
        },
        select: { id: true },
      }),
    ])

    if (staffConflict) {
      return NextResponse.json(
        { error: "Staff member already has an appointment in this time range." },
        { status: 409 }
      )
    }
    if (customerConflict) {
      return NextResponse.json(
        { error: "Customer already has an appointment in this time range." },
        { status: 409 }
      )
    }
  }

  const appointment = await prisma.appointment.update({
    where: { id },
    data: {
      ...(customer ? { customerId: customer.id } : {}),
      ...(service ? { serviceId: service.id } : {}),
      ...(staffProfile ? { staffProfileId: staffProfile.id } : {}),
      ...(data.startAt || data.serviceId ? { startAt: nextStartAt, endAt: nextEndAt } : {}),
      ...(data.status ? { status: data.status } : {}),
    },
    include: appointmentInclude,
  })

  return NextResponse.json({ appointment: serializeAppointment(appointment) })
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

  const appointment = await prisma.appointment.findUnique({
    where: { id },
    select: { id: true, status: true },
  })

  if (!appointment) {
    return NextResponse.json({ error: "Appointment not found." }, { status: 404 })
  }

  if (appointment.status === AppointmentStatus.CANCELED) {
    return NextResponse.json({ ok: true })
  }

  await prisma.appointment.update({
    where: { id },
    data: { status: AppointmentStatus.CANCELED },
  })

  return NextResponse.json({ ok: true })
}
