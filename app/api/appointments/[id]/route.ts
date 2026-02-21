import { NextResponse } from "next/server"
import { AppointmentStatus } from "@prisma/client"

import { auth } from "@/auth"
import {
  createApiLogContext,
  logApiRequestError,
  logApiRequestStart,
  logApiRequestSuccess,
  withRequestId,
} from "@/lib/api-logging"
import { canManageUsers, type Role } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
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
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { id } = await params
    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: appointmentInclude,
    })

    if (!appointment) {
      const response = NextResponse.json({ error: "Appointment not found." }, { status: 404 })
      logApiRequestSuccess(logContext, 404, { reason: "not_found", appointmentId: id })
      return withRequestId(response, logContext.requestId)
    }

    const response = NextResponse.json({ appointment: serializeAppointment(appointment) })
    logApiRequestSuccess(logContext, 200, { appointmentId: id })
    return withRequestId(response, logContext.requestId)
  } catch (error) {
    logApiRequestError(logContext, error, 500)
    const response = NextResponse.json({ error: "Unable to load appointment." }, { status: 500 })
    return withRequestId(response, logContext.requestId)
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { id } = await params
    const payload = await request.json()
    const parsed = appointmentUpdateSchema.safeParse(payload)
    if (!parsed.success) {
      const response = NextResponse.json(
        { error: "Invalid input.", details: parsed.error.flatten() },
        { status: 400 }
      )
      logApiRequestSuccess(logContext, 400, { reason: "validation_failed" })
      return withRequestId(response, logContext.requestId)
    }

    const data = parsed.data
    const current = await prisma.appointment.findUnique({
      where: { id },
      include: { service: { select: { id: true, durationMinutes: true, priceCents: true } } },
    })

    if (!current) {
      const response = NextResponse.json({ error: "Appointment not found." }, { status: 404 })
      logApiRequestSuccess(logContext, 404, { reason: "not_found", appointmentId: id })
      return withRequestId(response, logContext.requestId)
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
        const response = NextResponse.json({ error: "Customer not found." }, { status: 404 })
        logApiRequestSuccess(logContext, 404, { reason: "customer_not_found", appointmentId: id })
        return withRequestId(response, logContext.requestId)
      }
      if (customer.role !== "CUSTOMER") {
        const response = NextResponse.json({ error: "Selected user is not a customer." }, { status: 400 })
        logApiRequestSuccess(logContext, 400, { reason: "invalid_customer_role", appointmentId: id })
        return withRequestId(response, logContext.requestId)
      }
      if (customer.status !== "ACTIVE") {
        const response = NextResponse.json({ error: "Customer is not active." }, { status: 400 })
        logApiRequestSuccess(logContext, 400, { reason: "customer_inactive", appointmentId: id })
        return withRequestId(response, logContext.requestId)
      }
    }

    if (data.serviceId) {
      if (!service) {
        const response = NextResponse.json({ error: "Service not found." }, { status: 404 })
        logApiRequestSuccess(logContext, 404, { reason: "service_not_found", appointmentId: id })
        return withRequestId(response, logContext.requestId)
      }
      if (service.status !== "ACTIVE") {
        const response = NextResponse.json({ error: "Service is not active." }, { status: 400 })
        logApiRequestSuccess(logContext, 400, { reason: "service_inactive", appointmentId: id })
        return withRequestId(response, logContext.requestId)
      }
    }

    if (data.staffId) {
      if (!staffProfile) {
        const response = NextResponse.json({ error: "Staff profile not found." }, { status: 404 })
        logApiRequestSuccess(logContext, 404, { reason: "staff_profile_not_found", appointmentId: id })
        return withRequestId(response, logContext.requestId)
      }
      if (staffProfile.user.status !== "ACTIVE") {
        const response = NextResponse.json({ error: "Staff member is not active." }, { status: 400 })
        logApiRequestSuccess(logContext, 400, { reason: "staff_inactive", appointmentId: id })
        return withRequestId(response, logContext.requestId)
      }
    }

    const nextStartAt = data.startAt ? new Date(data.startAt) : current.startAt
    if (Number.isNaN(nextStartAt.getTime())) {
      const response = NextResponse.json({ error: "Invalid startAt value." }, { status: 400 })
      logApiRequestSuccess(logContext, 400, { reason: "invalid_start_at", appointmentId: id })
      return withRequestId(response, logContext.requestId)
    }
    if (data.startAt && nextStartAt <= new Date()) {
      const response = NextResponse.json({ error: "Cannot reschedule to the past." }, { status: 400 })
      logApiRequestSuccess(logContext, 400, { reason: "past_reschedule", appointmentId: id })
      return withRequestId(response, logContext.requestId)
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
        const response = NextResponse.json({ error: availability.reason }, { status: 409 })
        logApiRequestSuccess(logContext, 409, { reason: "staff_unavailable", appointmentId: id })
        return withRequestId(response, logContext.requestId)
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
        const response = NextResponse.json(
          { error: "Staff member already has an appointment in this time range." },
          { status: 409 }
        )
        logApiRequestSuccess(logContext, 409, { reason: "staff_conflict", appointmentId: id })
        return withRequestId(response, logContext.requestId)
      }
      if (customerConflict) {
        const response = NextResponse.json(
          { error: "Customer already has an appointment in this time range." },
          { status: 409 }
        )
        logApiRequestSuccess(logContext, 409, { reason: "customer_conflict", appointmentId: id })
        return withRequestId(response, logContext.requestId)
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

    const response = NextResponse.json({ appointment: serializeAppointment(appointment) })
    logApiRequestSuccess(logContext, 200, { appointmentId: id })
    return withRequestId(response, logContext.requestId)
  } catch (error) {
    logApiRequestError(logContext, error, 500)
    const response = NextResponse.json({ error: "Unable to update appointment." }, { status: 500 })
    return withRequestId(response, logContext.requestId)
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { id } = await params
    const appointment = await prisma.appointment.findUnique({
      where: { id },
      select: { id: true, status: true },
    })

    if (!appointment) {
      const response = NextResponse.json({ error: "Appointment not found." }, { status: 404 })
      logApiRequestSuccess(logContext, 404, { reason: "not_found", appointmentId: id })
      return withRequestId(response, logContext.requestId)
    }

    if (appointment.status === AppointmentStatus.CANCELED) {
      const response = NextResponse.json({ ok: true })
      logApiRequestSuccess(logContext, 200, { appointmentId: id, alreadyCanceled: true })
      return withRequestId(response, logContext.requestId)
    }

    await prisma.appointment.update({
      where: { id },
      data: { status: AppointmentStatus.CANCELED },
    })

    const response = NextResponse.json({ ok: true })
    logApiRequestSuccess(logContext, 200, { appointmentId: id, canceled: true })
    return withRequestId(response, logContext.requestId)
  } catch (error) {
    logApiRequestError(logContext, error, 500)
    const response = NextResponse.json({ error: "Unable to cancel appointment." }, { status: 500 })
    return withRequestId(response, logContext.requestId)
  }
}
