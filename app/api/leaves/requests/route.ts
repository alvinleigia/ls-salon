import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { z } from "zod"

import { auth } from "@/auth"
import type { Role } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { createLeaveRequestSchema } from "@/lib/validation"
import type { ListResponse } from "@/types/api"
import type { LeaveRequestRow } from "@/types/leaves"
import { notifyLeaveSubmitted } from "../_notifications"
import {
  leaveRequestSelect,
  serializeLeaveRequest,
  validateCreateLeaveRequestRules,
} from "../_requests"

const leaveRequestStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED", "CANCELED", "REVOKED"])

const leaveRequestListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(120).optional(),
  status: leaveRequestStatusSchema.optional(),
  leaveDefinitionId: z.string().trim().min(1).optional(),
  mineOnly: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
  staffUserId: z.string().trim().min(1).optional(),
  sort: z
    .enum(["startDate", "endDate", "status", "daysCount", "createdAt", "updatedAt"])
    .default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
})

export async function GET(request: Request) {
  const session = await auth()
  const role = (session?.user as { role?: string })?.role as Role | undefined
  const sessionUserId = (session?.user as { id?: string })?.id
  const isAdmin = role === "ADMIN"
  const isManager = role === "MANAGER"
  const isStaff = role === "STAFF"
  if (!session?.user || (!isAdmin && !isManager && !isStaff)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!sessionUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const parsed = leaveRequestListSchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams.entries())
  )
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query parameters.", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  let actorStaffProfile = await prisma.staffProfile.findUnique({
    where: { userId: sessionUserId },
    select: { id: true },
  })
  if ((isStaff || isManager) && !actorStaffProfile) {
    actorStaffProfile = await prisma.staffProfile.create({
      data: { userId: sessionUserId },
      select: { id: true },
    })
  }

  const { page, pageSize, q, status, leaveDefinitionId, mineOnly, staffUserId, sort, order } =
    parsed.data

  let staffProfileFilterId: string | undefined
  if (isStaff) {
    if (!actorStaffProfile) {
      return NextResponse.json({ error: "Staff profile not found." }, { status: 400 })
    }
    staffProfileFilterId = actorStaffProfile.id
  } else if (mineOnly) {
    if (!actorStaffProfile) {
      return NextResponse.json({ error: "Staff profile not found for mine-only filter." }, { status: 400 })
    }
    staffProfileFilterId = actorStaffProfile.id
  } else if (staffUserId) {
    const selectedStaffProfile = await prisma.staffProfile.findUnique({
      where: { userId: staffUserId },
      select: { id: true },
    })
    if (!selectedStaffProfile) {
      return NextResponse.json({ error: "Selected staff user not found." }, { status: 404 })
    }
    staffProfileFilterId = selectedStaffProfile.id
  }

  const where: Prisma.LeaveRequestWhereInput = {
    ...(isManager && !mineOnly
      ? {
          staffProfile: {
            managerUserId: sessionUserId,
            user: { role: "STAFF" },
          },
        }
      : {}),
    ...(status ? { status } : {}),
    ...(leaveDefinitionId ? { leaveDefinitionId } : {}),
    ...(staffProfileFilterId ? { staffProfileId: staffProfileFilterId } : {}),
    ...(q
      ? {
          OR: [
            { reason: { contains: q, mode: "insensitive" } },
            { leaveDefinition: { code: { contains: q, mode: "insensitive" } } },
            { leaveDefinition: { name: { contains: q, mode: "insensitive" } } },
            { staffProfile: { user: { name: { contains: q, mode: "insensitive" } } } },
            { staffProfile: { user: { email: { contains: q, mode: "insensitive" } } } },
          ],
        }
      : {}),
  }

  const [total, items] = await prisma.$transaction([
    prisma.leaveRequest.count({ where }),
    prisma.leaveRequest.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { [sort]: order },
      select: leaveRequestSelect,
    }),
  ])

  const response: ListResponse<LeaveRequestRow> = {
    items: items.map(serializeLeaveRequest),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  }
  return NextResponse.json(response)
}

export async function POST(request: Request) {
  const session = await auth()
  const role = (session?.user as { role?: string })?.role as Role | undefined
  const sessionUserId = (session?.user as { id?: string })?.id
  const isManager = role === "MANAGER"
  const isStaff = role === "STAFF"
  if (!session?.user || (!isManager && !isStaff)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!sessionUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const staffProfile = await prisma.staffProfile.findUnique({
    where: { userId: sessionUserId },
    select: { id: true },
  })
  const resolvedStaffProfile =
    staffProfile ??
    (await prisma.staffProfile.create({
      data: { userId: sessionUserId },
      select: { id: true },
    }))
  if (!resolvedStaffProfile) {
    return NextResponse.json({ error: "Staff profile not found." }, { status: 400 })
  }

  const payload = await request.json().catch(() => ({}))
  const parsed = createLeaveRequestSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  try {
    const item = await prisma.$transaction(async (tx) => {
      const validated = await validateCreateLeaveRequestRules({
        tx,
        staffProfileId: resolvedStaffProfile.id,
        leaveDefinitionId: parsed.data.leaveDefinitionId,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
      })

      const created = await tx.leaveRequest.create({
        data: {
          staffProfileId: resolvedStaffProfile.id,
          leaveDefinitionId: parsed.data.leaveDefinitionId,
          startDate: validated.startDate,
          endDate: validated.endDate,
          daysCount: validated.daysCount,
          reason: parsed.data.reason?.trim() || null,
          status: "PENDING",
        },
      })

      return tx.leaveRequest.findUniqueOrThrow({
        where: { id: created.id },
        select: leaveRequestSelect,
      })
    })

    const serialized = serializeLeaveRequest(item)
    void notifyLeaveSubmitted(prisma, {
      staffUserId: serialized.staff.userId,
      leaveCode: serialized.leaveDefinition.code,
      leaveName: serialized.leaveDefinition.name,
      startDateIso: serialized.startDate.slice(0, 10),
      endDateIso: serialized.endDate.slice(0, 10),
      daysCount: serialized.daysCount,
    })

    return NextResponse.json({ item: serialized }, { status: 201 })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "Unable to create leave request." }, { status: 500 })
  }
}
