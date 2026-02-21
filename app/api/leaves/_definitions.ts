import { Prisma, type PrismaClient } from "@prisma/client"

import type { LeaveDefinitionRow } from "@/types/leaves"

type DbClient = PrismaClient | Prisma.TransactionClient

type LeaveDefinitionWithLinks = {
  id: string
  code: string
  name: string
  leaveType: LeaveDefinitionRow["leaveType"]
  allowedUsers: LeaveDefinitionRow["allowedUsers"]
  minDaysPerRequest: number
  maxDaysPerRequest: number
  allowWithOtherLeaves: boolean
  priorEntryAllowed: boolean
  noticeDays: number
  allowCarryForward: boolean
  weekOffSingleSideAllowed: boolean
  weekOffBothSideAllowed: boolean
  holidaySingleSideAllowed: boolean
  holidayBothSideAllowed: boolean
  maxConsecutiveDays: number
  maxPendingRequests: number
  status: LeaveDefinitionRow["status"]
  sortOrder: number
  createdAt: Date
  updatedAt: Date
  nonClubbableWithFrom: Array<{
    blockedLeave: {
      id: string
      code: string
      name: string
    }
  }>
}

export const leaveDefinitionSelect = {
  id: true,
  code: true,
  name: true,
  leaveType: true,
  allowedUsers: true,
  minDaysPerRequest: true,
  maxDaysPerRequest: true,
  allowWithOtherLeaves: true,
  priorEntryAllowed: true,
  noticeDays: true,
  allowCarryForward: true,
  weekOffSingleSideAllowed: true,
  weekOffBothSideAllowed: true,
  holidaySingleSideAllowed: true,
  holidayBothSideAllowed: true,
  maxConsecutiveDays: true,
  maxPendingRequests: true,
  status: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
  nonClubbableWithFrom: {
    select: {
      blockedLeave: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
    },
  },
} satisfies Prisma.LeaveDefinitionSelect

export const serializeLeaveDefinition = (
  item: LeaveDefinitionWithLinks
): LeaveDefinitionRow => ({
  id: item.id,
  code: item.code,
  name: item.name,
  leaveType: item.leaveType,
  allowedUsers: item.allowedUsers,
  minDaysPerRequest: item.minDaysPerRequest,
  maxDaysPerRequest: item.maxDaysPerRequest,
  allowWithOtherLeaves: item.allowWithOtherLeaves,
  priorEntryAllowed: item.priorEntryAllowed,
  noticeDays: item.noticeDays,
  allowCarryForward: item.allowCarryForward,
  weekOffSingleSideAllowed: item.weekOffSingleSideAllowed,
  weekOffBothSideAllowed: item.weekOffBothSideAllowed,
  holidaySingleSideAllowed: item.holidaySingleSideAllowed,
  holidayBothSideAllowed: item.holidayBothSideAllowed,
  maxConsecutiveDays: item.maxConsecutiveDays,
  maxPendingRequests: item.maxPendingRequests,
  status: item.status,
  sortOrder: item.sortOrder,
  createdAt: item.createdAt.toISOString(),
  updatedAt: item.updatedAt.toISOString(),
  nonClubbableWith: item.nonClubbableWithFrom.map((link) => link.blockedLeave),
})

export const replaceNonClubbableRules = async (
  tx: DbClient,
  leaveDefinitionId: string,
  nonClubbableWithIds: string[],
  tenantId?: string
) => {
  const uniqueIds = Array.from(
    new Set(
      nonClubbableWithIds
        .map((id) => id.trim())
        .filter((id) => id && id !== leaveDefinitionId)
    )
  )

  if (uniqueIds.length > 0) {
    const existingCount = await tx.leaveDefinition.count({
      where: { id: { in: uniqueIds }, ...(tenantId ? { tenantId } : {}) },
    })
    if (existingCount !== uniqueIds.length) {
      throw new Error("One or more non-clubbable leave definitions were not found.")
    }
  }

  await tx.leaveDefinitionNonClubbable.deleteMany({
    where: {
      OR: [{ leaveDefinitionId }, { blockedLeaveId: leaveDefinitionId }],
    },
  })

  if (!uniqueIds.length) return

  const pairs = uniqueIds.flatMap((blockedLeaveId) => [
    { leaveDefinitionId, blockedLeaveId },
    { leaveDefinitionId: blockedLeaveId, blockedLeaveId: leaveDefinitionId },
  ])

  await tx.leaveDefinitionNonClubbable.createMany({
    data: pairs,
    skipDuplicates: true,
  })
}
