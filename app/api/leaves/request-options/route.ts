import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { canManageUsers, type Role } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  const role = (session?.user as { role?: string })?.role as Role | undefined
  const sessionUserId = (session?.user as { id?: string })?.id
  const isManager = canManageUsers(role ?? null)
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
  if (!staffProfile) {
    return NextResponse.json({ items: [] })
  }

  const items = await prisma.leaveDefinition.findMany({
    where: {
      status: "ACTIVE",
      leaveGroups: {
        some: {
          leaveGroup: {
            status: "ACTIVE",
            OR: [
              { assignmentMode: "ALL_STAFF" },
              {
                assignmentMode: "SELECTED_STAFF",
                staffAssignments: {
                  some: {
                    staffProfileId: staffProfile.id,
                  },
                },
              },
            ],
          },
        },
      },
    },
    select: {
      id: true,
      code: true,
      name: true,
      sortOrder: true,
    },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
  })

  return NextResponse.json({
    items: items.map((item) => ({
      value: item.id,
      label: `${item.code} - ${item.name}`,
    })),
  })
}
