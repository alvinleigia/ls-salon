import { Prisma, type PrismaClient } from "@prisma/client"

import type { LeaveGroupRow } from "@/types/leaves"

type DbClient = PrismaClient | Prisma.TransactionClient

type LeaveGroupWithRelations = {
  id: string
  code: string
  name: string
  description: string | null
  assignmentMode: LeaveGroupRow["assignmentMode"]
  status: LeaveGroupRow["status"]
  sortOrder: number
  createdAt: Date
  updatedAt: Date
  leaves: Array<{
    leaveDefinition: {
      id: string
      code: string
      name: string
    }
  }>
  staffAssignments: Array<{
    staffProfile: {
      id: string
      user: {
        id: string
        name: string | null
        email: string
      }
    }
  }>
}

export const leaveGroupSelect = {
  id: true,
  code: true,
  name: true,
  description: true,
  assignmentMode: true,
  status: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
  leaves: {
    select: {
      leaveDefinition: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
    },
    orderBy: {
      leaveDefinition: {
        sortOrder: "asc",
      },
    },
  },
  staffAssignments: {
    select: {
      staffProfile: {
        select: {
          id: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
    orderBy: {
      staffProfile: {
        user: {
          name: "asc",
        },
      },
    },
  },
} satisfies Prisma.LeaveGroupSelect

export const serializeLeaveGroup = (item: LeaveGroupWithRelations): LeaveGroupRow => ({
  id: item.id,
  code: item.code,
  name: item.name,
  description: item.description,
  assignmentMode: item.assignmentMode,
  status: item.status,
  sortOrder: item.sortOrder,
  createdAt: item.createdAt.toISOString(),
  updatedAt: item.updatedAt.toISOString(),
  leaveDefinitions: item.leaves.map((link) => link.leaveDefinition),
  assignedStaff: item.staffAssignments.map((assignment) => ({
    id: assignment.staffProfile.id,
    userId: assignment.staffProfile.user.id,
    name: assignment.staffProfile.user.name,
    email: assignment.staffProfile.user.email,
  })),
})

export const replaceGroupLeaves = async (
  tx: DbClient,
  leaveGroupId: string,
  leaveDefinitionIds: string[]
) => {
  const uniqueIds = Array.from(new Set(leaveDefinitionIds.map((id) => id.trim()).filter(Boolean)))
  if (!uniqueIds.length) {
    throw new Error("Select at least one leave definition.")
  }

  const count = await tx.leaveDefinition.count({
    where: { id: { in: uniqueIds } },
  })
  if (count !== uniqueIds.length) {
    throw new Error("One or more selected leave definitions were not found.")
  }

  await tx.leaveGroupLeave.deleteMany({ where: { leaveGroupId } })
  await tx.leaveGroupLeave.createMany({
    data: uniqueIds.map((leaveDefinitionId) => ({
      leaveGroupId,
      leaveDefinitionId,
    })),
    skipDuplicates: true,
  })
}

export const replaceGroupStaffAssignments = async (
  tx: DbClient,
  leaveGroupId: string,
  assignmentMode: LeaveGroupRow["assignmentMode"],
  staffUserIds: string[]
) => {
  await tx.leaveGroupStaffAssignment.deleteMany({ where: { leaveGroupId } })
  if (assignmentMode === "ALL_STAFF") return

  const uniqueUserIds = Array.from(new Set(staffUserIds.map((id) => id.trim()).filter(Boolean)))
  if (!uniqueUserIds.length) {
    throw new Error("Select at least one employee for selective assignment.")
  }

  const staffProfiles = await tx.staffProfile.findMany({
    where: { userId: { in: uniqueUserIds } },
    select: { id: true, userId: true, user: { select: { role: true, status: true } } },
  })
  if (staffProfiles.length !== uniqueUserIds.length) {
    throw new Error("One or more selected employees were not found.")
  }

  const invalid = staffProfiles.find(
    (staff) => staff.user.role !== "STAFF" || staff.user.status !== "ACTIVE"
  )
  if (invalid) {
    throw new Error("Only active staff can be assigned to a leave group.")
  }

  await tx.leaveGroupStaffAssignment.createMany({
    data: staffProfiles.map((staff) => ({
      leaveGroupId,
      staffProfileId: staff.id,
    })),
    skipDuplicates: true,
  })
}
