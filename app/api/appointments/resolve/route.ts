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
import { checkStaffAppointmentAvailability } from "@/app/api/appointments/_availability"
import { prisma } from "@/lib/prisma"
import { canManageUsers, type Role } from "@/lib/permissions"
import { appointmentResolveSchema } from "@/lib/validation"
import type { ResolveAppointmentsInput } from "@/types/appointments"

const ACTIVE_APPOINTMENT_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.SCHEDULED,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.IN_PROGRESS,
]

const buildDateTime = (date: string, time: string) => {
  if (!date || !time) return null
  return new Date(`${date}T${time}:00.000Z`)
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

  try {
    const payload = await request.json()
    const parsed = appointmentResolveSchema.safeParse(payload)
    if (!parsed.success) {
      const response = NextResponse.json(
        { error: "Invalid request.", details: parsed.error.flatten() },
        { status: 400 }
      )
      logApiRequestSuccess(logContext, 400, { reason: "validation_failed" })
      return withRequestId(response, logContext.requestId)
    }

  const body: ResolveAppointmentsInput = parsed.data
  const appointmentIds = body.appointmentIds
    if (!appointmentIds.length || !body.action) {
      const response = NextResponse.json({ error: "Invalid request." }, { status: 400 })
      logApiRequestSuccess(logContext, 400, { reason: "invalid_payload" })
      return withRequestId(response, logContext.requestId)
    }

  if (body.action === "cancel") {
    const result = await prisma.appointment.updateMany({
      where: { id: { in: appointmentIds } },
      data: { status: AppointmentStatus.CANCELED },
    })
      const response = NextResponse.json({ updatedCount: result.count })
      logApiRequestSuccess(logContext, 200, { action: body.action, updatedCount: result.count })
      return withRequestId(response, logContext.requestId)
    }

  if (body.action === "reassign") {
    if (!body.targetStaffId) {
      const response = NextResponse.json({ error: "Target staff is required." }, { status: 400 })
      logApiRequestSuccess(logContext, 400, { reason: "missing_target_staff" })
      return withRequestId(response, logContext.requestId)
    }
    const staffProfile = await prisma.staffProfile.findFirst({
      where: { userId: body.targetStaffId },
      select: { id: true },
    })
    if (!staffProfile) {
      const response = NextResponse.json({ error: "Target staff profile not found." }, { status: 404 })
      logApiRequestSuccess(logContext, 404, { reason: "target_staff_not_found" })
      return withRequestId(response, logContext.requestId)
    }
    const result = await prisma.appointment.updateMany({
      where: { id: { in: appointmentIds } },
      data: { staffProfileId: staffProfile.id },
    })
      const response = NextResponse.json({ updatedCount: result.count })
      logApiRequestSuccess(logContext, 200, { action: body.action, updatedCount: result.count })
      return withRequestId(response, logContext.requestId)
    }

  if (body.action === "reschedule") {
    if (!body.rescheduleDate || !body.rescheduleTime) {
      const response = NextResponse.json({ error: "Reschedule date and time are required." }, { status: 400 })
      logApiRequestSuccess(logContext, 400, { reason: "missing_reschedule_datetime" })
      return withRequestId(response, logContext.requestId)
    }
    const nextStart = buildDateTime(body.rescheduleDate, body.rescheduleTime)
    if (!nextStart || Number.isNaN(nextStart.getTime())) {
      const response = NextResponse.json({ error: "Invalid reschedule date/time." }, { status: 400 })
      logApiRequestSuccess(logContext, 400, { reason: "invalid_reschedule_datetime" })
      return withRequestId(response, logContext.requestId)
    }

    const appointments = await prisma.appointment.findMany({
      where: { id: { in: appointmentIds } },
      select: { id: true, startAt: true, endAt: true, staffProfileId: true },
      orderBy: { startAt: "asc" },
    })
    if (!appointments.length) {
      const response = NextResponse.json({ updatedCount: 0 })
      logApiRequestSuccess(logContext, 200, { action: body.action, updatedCount: 0 })
      return withRequestId(response, logContext.requestId)
    }

    const firstStartAt = appointments[0].startAt.getTime()
    const plannedMoves = appointments.map((appointment) => {
      const deltaMinutes = Math.round((appointment.startAt.getTime() - firstStartAt) / 60000)
      const startAt = new Date(nextStart)
      startAt.setMinutes(startAt.getMinutes() + deltaMinutes)
      const durationMinutes = Math.max(
        1,
        Math.round((appointment.endAt.getTime() - appointment.startAt.getTime()) / 60000)
      )
      const endAt = new Date(startAt)
      endAt.setMinutes(endAt.getMinutes() + durationMinutes)
      return {
        id: appointment.id,
        staffProfileId: appointment.staffProfileId,
        startAt,
        endAt,
      }
    })

    for (const move of plannedMoves) {
      if (move.startAt <= new Date()) {
        const response = NextResponse.json(
          { error: "Cannot reschedule appointments to the past." },
          { status: 400 }
        )
        logApiRequestSuccess(logContext, 400, { reason: "past_reschedule_datetime" })
        return withRequestId(response, logContext.requestId)
      }
      const availability = await checkStaffAppointmentAvailability(
        move.staffProfileId,
        move.startAt,
        move.endAt
      )
      if (!availability.ok) {
        const response = NextResponse.json(
          {
            error: `Reschedule failed for appointment ${move.id}: ${availability.reason}`,
          },
          { status: 409 }
        )
        logApiRequestSuccess(logContext, 409, { reason: "staff_unavailable", appointmentId: move.id })
        return withRequestId(response, logContext.requestId)
      }
      const conflict = await prisma.appointment.findFirst({
        where: {
          id: { notIn: appointmentIds },
          staffProfileId: move.staffProfileId,
          status: { in: ACTIVE_APPOINTMENT_STATUSES },
          startAt: { lt: move.endAt },
          endAt: { gt: move.startAt },
        },
        select: { id: true },
      })
      if (conflict) {
        const response = NextResponse.json(
          {
            error: `Reschedule failed for appointment ${move.id}: staff has another appointment conflict.`,
          },
          { status: 409 }
        )
        logApiRequestSuccess(logContext, 409, { reason: "staff_conflict", appointmentId: move.id })
        return withRequestId(response, logContext.requestId)
      }
    }

    const updates = plannedMoves.map((move) => {
      return prisma.appointment.update({
        where: { id: move.id },
        data: { startAt: move.startAt, endAt: move.endAt },
      })
    })

    await prisma.$transaction(updates)
      const response = NextResponse.json({ updatedCount: updates.length })
      logApiRequestSuccess(logContext, 200, { action: body.action, updatedCount: updates.length })
      return withRequestId(response, logContext.requestId)
  }

    const response = NextResponse.json({ error: "Unsupported action." }, { status: 400 })
    logApiRequestSuccess(logContext, 400, { reason: "unsupported_action", action: body.action })
    return withRequestId(response, logContext.requestId)
  } catch (error) {
    logApiRequestError(logContext, error, 500)
    const response = NextResponse.json({ error: "Unable to resolve appointments." }, { status: 500 })
    return withRequestId(response, logContext.requestId)
  }
}
