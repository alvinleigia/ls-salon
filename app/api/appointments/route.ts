import { NextResponse } from "next/server"
import { AppointmentStatus, Prisma } from "@prisma/client"
import { z } from "zod"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { appointmentCreateSchema } from "@/lib/validation"
import { canManageUsers, type Role } from "@/lib/permissions"
import type { ListResponse } from "@/types/api"
import type { AppointmentRow } from "@/types/appointments"
import { checkStaffAppointmentAvailability } from "./_availability"

const appointmentListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().optional(),
  staffId: z.string().trim().optional(),
  customerId: z.string().trim().optional(),
  status: z
    .enum(["SCHEDULED", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELED", "NO_SHOW"])
    .optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  sort: z.enum(["startAt", "endAt", "createdAt", "updatedAt", "status"]).default("startAt"),
  order: z.enum(["asc", "desc"]).default("asc"),
})

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

export async function GET(request: Request) {
  const session = await auth()
  const role = (session?.user as { role?: string })?.role

  if (!session?.user || !canManageUsers(role as Role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  const parsed = appointmentListSchema.safeParse(Object.fromEntries(url.searchParams.entries()))
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query parameters.", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { page, pageSize, q, staffId, customerId, status, startDate, endDate, sort, order } =
    parsed.data

  const where: Prisma.AppointmentWhereInput = {}

  if (staffId) {
    where.staffProfile = { userId: staffId }
  }
  if (customerId) {
    where.customerId = customerId
  }
  if (status) {
    where.status = status
  }
  if (startDate || endDate) {
    where.startAt = {}
    if (startDate) {
      where.startAt.gte = new Date(`${startDate}T00:00:00.000Z`)
    }
    if (endDate) {
      where.startAt.lte = new Date(`${endDate}T23:59:59.999Z`)
    }
  }
  if (q) {
    where.OR = [
      { customer: { name: { contains: q, mode: Prisma.QueryMode.insensitive } } },
      { customer: { email: { contains: q, mode: Prisma.QueryMode.insensitive } } },
      { service: { name: { contains: q, mode: Prisma.QueryMode.insensitive } } },
      { staffProfile: { user: { name: { contains: q, mode: Prisma.QueryMode.insensitive } } } },
      { staffProfile: { user: { email: { contains: q, mode: Prisma.QueryMode.insensitive } } } },
    ]
  }

  let orderBy: Prisma.AppointmentOrderByWithRelationInput
  switch (sort) {
    case "endAt":
      orderBy = { endAt: order }
      break
    case "createdAt":
      orderBy = { createdAt: order }
      break
    case "updatedAt":
      orderBy = { updatedAt: order }
      break
    case "status":
      orderBy = { status: order }
      break
    default:
      orderBy = { startAt: order }
  }

  const skip = (page - 1) * pageSize
  const [total, appointments] = await prisma.$transaction([
    prisma.appointment.count({ where }),
    prisma.appointment.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, email: true } },
        service: { select: { id: true, name: true, durationMinutes: true } },
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
      },
      orderBy,
      skip,
      take: pageSize,
    }),
  ])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const response: ListResponse<AppointmentRow> = {
    items: appointments.map(serializeAppointment),
    page,
    pageSize,
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

  const payload = await request.json()
  const parsed = appointmentCreateSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const data = parsed.data
  const startAt = new Date(data.startAt)
  if (Number.isNaN(startAt.getTime())) {
    return NextResponse.json({ error: "Invalid startAt value." }, { status: 400 })
  }
  if (startAt <= new Date()) {
    return NextResponse.json({ error: "Cannot book appointments in the past." }, { status: 400 })
  }

  const [customer, service, staffProfile] = await Promise.all([
    prisma.user.findUnique({
      where: { id: data.customerId },
      select: { id: true, role: true, status: true, name: true, email: true },
    }),
    prisma.service.findUnique({
      where: { id: data.serviceId },
      select: { id: true, name: true, durationMinutes: true, status: true },
    }),
    prisma.staffProfile.findFirst({
      where: { userId: data.staffId, user: { role: "STAFF" } },
      select: { id: true, user: { select: { id: true, name: true, email: true, status: true } } },
    }),
  ])

  if (!customer) {
    return NextResponse.json({ error: "Customer not found." }, { status: 404 })
  }
  if (customer.role !== "CUSTOMER") {
    return NextResponse.json({ error: "Selected user is not a customer." }, { status: 400 })
  }
  if (customer.status !== "ACTIVE") {
    return NextResponse.json({ error: "Customer is not active." }, { status: 400 })
  }

  if (!service) {
    return NextResponse.json({ error: "Service not found." }, { status: 404 })
  }
  if (service.status !== "ACTIVE") {
    return NextResponse.json({ error: "Service is not active." }, { status: 400 })
  }

  if (!staffProfile) {
    return NextResponse.json({ error: "Staff profile not found." }, { status: 404 })
  }
  if (staffProfile.user.status !== "ACTIVE") {
    return NextResponse.json({ error: "Staff member is not active." }, { status: 400 })
  }

  const endAt = new Date(startAt)
  endAt.setMinutes(endAt.getMinutes() + service.durationMinutes)

  const availability = await checkStaffAppointmentAvailability(staffProfile.id, startAt, endAt)
  if (!availability.ok) {
    return NextResponse.json({ error: availability.reason }, { status: 409 })
  }

  const [staffConflict, customerConflict] = await Promise.all([
    prisma.appointment.findFirst({
      where: {
        staffProfileId: staffProfile.id,
        status: { in: ACTIVE_APPOINTMENT_STATUSES },
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
      select: { id: true },
    }),
    prisma.appointment.findFirst({
      where: {
        customerId: customer.id,
        status: { in: ACTIVE_APPOINTMENT_STATUSES },
        startAt: { lt: endAt },
        endAt: { gt: startAt },
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

  const appointment = await prisma.appointment.create({
    data: {
      customerId: customer.id,
      serviceId: service.id,
      staffProfileId: staffProfile.id,
      startAt,
      endAt,
      status: data.status ?? AppointmentStatus.SCHEDULED,
    },
    include: {
      customer: { select: { id: true, name: true, email: true } },
      service: { select: { id: true, name: true, durationMinutes: true } },
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
    },
  })

  return NextResponse.json({ appointment: serializeAppointment(appointment) }, { status: 201 })
}
