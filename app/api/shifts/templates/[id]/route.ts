import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { shiftTemplateSchema } from "@/lib/validation"
import { canManageUsers, type Role } from "@/lib/permissions"

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

  const body = await request.json()
  const parsed = shiftTemplateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const data = parsed.data
  const template = await prisma.$transaction(async (tx) => {
    const updated = await tx.shiftTemplate.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description || null,
        color: data.color || null,
        isActive: data.isActive ?? true,
        startTime: data.startTime,
        endTime: data.endTime,
      },
    })
    await tx.shiftTemplateBreak.deleteMany({ where: { templateId: id } })
    if (data.breaks.length) {
      await tx.shiftTemplateBreak.createMany({
        data: data.breaks.map((period, index) => ({
          templateId: id,
          startTime: period.startTime,
          endTime: period.endTime,
          sortOrder: period.sortOrder ?? index,
        })),
      })
    }
    return updated
  })

  const withBreaks = await prisma.shiftTemplate.findUnique({
    where: { id: template.id },
    include: { breaks: { orderBy: { sortOrder: "asc" } } },
  })

  return NextResponse.json({ template: withBreaks })
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

  const assignments = await prisma.staffShiftAssignment.count({
    where: { templateId: id },
  })
  if (assignments > 0) {
    return NextResponse.json(
      { error: "Template is assigned to staff and cannot be deleted." },
      { status: 409 }
    )
  }

  await prisma.shiftTemplate.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
