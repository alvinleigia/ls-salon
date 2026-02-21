import { NextResponse } from "next/server"
import { AppointmentStatus } from "@prisma/client"
import { z } from "zod"

import { auth } from "@/auth"
import {
  createApiLogContext,
  logApiRequestError,
  logApiRequestStart,
  logApiRequestSuccess,
  withRequestId,
} from "@/lib/api-logging"
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
    const payload = await request.json()
    const parsed = availabilitySchema.safeParse(payload)
    if (!parsed.success) {
      const response = NextResponse.json(
        { error: "Invalid input.", details: parsed.error.flatten() },
        { status: 400 }
      )
      logApiRequestSuccess(logContext, 400, { reason: "validation_failed" })
      return withRequestId(response, logContext.requestId)
    }

  const { appointmentId, customerId, serviceId, staffId, startAt: startAtRaw } = parsed.data

  const startAt = new Date(startAtRaw)
    if (Number.isNaN(startAt.getTime())) {
      const response = NextResponse.json({ available: false, reason: "Invalid appointment date/time." })
      logApiRequestSuccess(logContext, 200, { available: false, reason: "invalid_datetime" })
      return withRequestId(response, logContext.requestId)
    }
    if (startAt <= new Date()) {
      const response = NextResponse.json({ available: false, reason: "Cannot book appointments in the past." })
      logApiRequestSuccess(logContext, 200, { available: false, reason: "past_datetime" })
      return withRequestId(response, logContext.requestId)
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
      const response = NextResponse.json({ available: false, reason: "Staff member is not available." })
      logApiRequestSuccess(logContext, 200, { available: false, reason: "staff_unavailable" })
      return withRequestId(response, logContext.requestId)
    }
    if (!service || service.status !== "ACTIVE") {
      const response = NextResponse.json({ available: false, reason: "Service is not active." })
      logApiRequestSuccess(logContext, 200, { available: false, reason: "service_inactive" })
      return withRequestId(response, logContext.requestId)
    }
  if (customerId) {
    if (!customer || customer.role !== "CUSTOMER" || customer.status !== "ACTIVE") {
      const response = NextResponse.json({ available: false, reason: "Customer is not active." })
      logApiRequestSuccess(logContext, 200, { available: false, reason: "customer_inactive" })
      return withRequestId(response, logContext.requestId)
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
    const response = NextResponse.json(result)
    logApiRequestSuccess(logContext, 200, { available: false, reason: staffShiftAvailability.reason })
    return withRequestId(response, logContext.requestId)
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
    const response = NextResponse.json({
      available: false,
      reason: "Staff member already has an appointment in this time range.",
    } satisfies AppointmentAvailabilityResult)
    logApiRequestSuccess(logContext, 200, { available: false, reason: "staff_conflict" })
    return withRequestId(response, logContext.requestId)
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
      const response = NextResponse.json({
        available: false,
        reason: "Customer already has an appointment in this time range.",
      } satisfies AppointmentAvailabilityResult)
      logApiRequestSuccess(logContext, 200, { available: false, reason: "customer_conflict" })
      return withRequestId(response, logContext.requestId)
    }
  }

    const response = NextResponse.json({ available: true } satisfies AppointmentAvailabilityResult)
    logApiRequestSuccess(logContext, 200, { available: true })
    return withRequestId(response, logContext.requestId)
  } catch (error) {
    logApiRequestError(logContext, error, 500)
    const response = NextResponse.json({ error: "Unable to check availability." }, { status: 500 })
    return withRequestId(response, logContext.requestId)
  }
}
