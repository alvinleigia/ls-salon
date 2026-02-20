import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { z } from "zod"

import { auth } from "@/auth"
import { canManageUsers, type Role } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import {
  createLeaveDefinitionSchema,
  leaveDefinitionAllowedUsersSchema,
  leaveDefinitionStatusSchema,
  leaveDefinitionTypeSchema,
} from "@/lib/validation"
import type { ListResponse } from "@/types/api"
import type { LeaveDefinitionRow } from "@/types/leaves"
import {
  leaveDefinitionSelect,
  replaceNonClubbableRules,
  serializeLeaveDefinition,
} from "../_definitions"

const leaveDefinitionListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(120).optional(),
  status: leaveDefinitionStatusSchema.optional(),
  leaveType: leaveDefinitionTypeSchema.optional(),
  allowedUsers: leaveDefinitionAllowedUsersSchema.optional(),
  sort: z
    .enum(["code", "name", "leaveType", "allowedUsers", "status", "sortOrder", "createdAt", "updatedAt"])
    .default("sortOrder"),
  order: z.enum(["asc", "desc"]).default("asc"),
})

export async function GET(request: Request) {
  const session = await auth()
  const role = (session?.user as { role?: string })?.role
  if (!session?.user || !canManageUsers(role as Role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const parsed = leaveDefinitionListSchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams.entries())
  )
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query parameters.", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { page, pageSize, q, status, leaveType, allowedUsers, sort, order } = parsed.data
  const where: Prisma.LeaveDefinitionWhereInput = {
    ...(status ? { status } : {}),
    ...(leaveType ? { leaveType } : {}),
    ...(allowedUsers ? { allowedUsers } : {}),
    ...(q
      ? {
          OR: [
            { code: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  }

  const [total, items] = await prisma.$transaction([
    prisma.leaveDefinition.count({ where }),
    prisma.leaveDefinition.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { [sort]: order },
      select: leaveDefinitionSelect,
    }),
  ])

  const response: ListResponse<LeaveDefinitionRow> = {
    items: items.map(serializeLeaveDefinition),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  }
  return NextResponse.json(response)
}

export async function POST(request: Request) {
  const session = await auth()
  const role = (session?.user as { role?: string })?.role
  if (!session?.user || !canManageUsers(role as Role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const payload = await request.json().catch(() => ({}))
  const parsed = createLeaveDefinitionSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const code = parsed.data.code.trim().toUpperCase()
  const name = parsed.data.name.trim()
  const existing = await prisma.leaveDefinition.findFirst({
    where: { OR: [{ code }, { name }] },
    select: { id: true, code: true, name: true },
  })
  if (existing) {
    return NextResponse.json(
      {
        error:
          existing.code === code
            ? "Leave code already exists."
            : "Leave name already exists.",
      },
      { status: 409 }
    )
  }

  try {
    const item = await prisma.$transaction(async (tx) => {
      const created = await tx.leaveDefinition.create({
        data: {
          code,
          name,
          leaveType: parsed.data.leaveType,
          allowedUsers: parsed.data.allowedUsers,
          minDaysPerRequest: parsed.data.minDaysPerRequest,
          maxDaysPerRequest: parsed.data.maxDaysPerRequest,
          allowWithOtherLeaves: parsed.data.allowWithOtherLeaves,
          priorEntryAllowed: parsed.data.priorEntryAllowed,
          noticeDays: parsed.data.noticeDays,
          allowCarryForward: parsed.data.allowCarryForward,
          weekOffSingleSideAllowed: parsed.data.weekOffSingleSideAllowed,
          weekOffBothSideAllowed: parsed.data.weekOffBothSideAllowed,
          holidaySingleSideAllowed: parsed.data.holidaySingleSideAllowed,
          holidayBothSideAllowed: parsed.data.holidayBothSideAllowed,
          maxConsecutiveDays: parsed.data.maxConsecutiveDays,
          maxPendingRequests: parsed.data.maxPendingRequests,
          status: parsed.data.status,
          sortOrder: parsed.data.sortOrder,
        },
      })
      await replaceNonClubbableRules(tx, created.id, parsed.data.nonClubbableWithIds)
      return tx.leaveDefinition.findUniqueOrThrow({
        where: { id: created.id },
        select: leaveDefinitionSelect,
      })
    })
    return NextResponse.json({ item: serializeLeaveDefinition(item) }, { status: 201 })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "Unable to create leave definition." }, { status: 500 })
  }
}
