import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { canManageUsers, type Role } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { updateLeaveGroupSchema } from "@/lib/validation"
import {
  leaveGroupSelect,
  replaceGroupLeaves,
  replaceGroupStaffAssignments,
  serializeLeaveGroup,
} from "../../_groups"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const role = (session?.user as { role?: string })?.role
  if (!session?.user || !canManageUsers(role as Role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const item = await prisma.leaveGroup.findUnique({
    where: { id },
    select: leaveGroupSelect,
  })
  if (!item) {
    return NextResponse.json({ error: "Leave group not found." }, { status: 404 })
  }
  return NextResponse.json({ item: serializeLeaveGroup(item) })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const role = (session?.user as { role?: string })?.role
  if (!session?.user || !canManageUsers(role as Role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const current = await prisma.leaveGroup.findUnique({
    where: { id },
    select: { id: true, code: true, name: true, assignmentMode: true },
  })
  if (!current) {
    return NextResponse.json({ error: "Leave group not found." }, { status: 404 })
  }

  const payload = await request.json().catch(() => ({}))
  const parsed = updateLeaveGroupSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const code = parsed.data.code?.trim().toUpperCase()
  const name = parsed.data.name?.trim()
  if (code || name) {
    const existing = await prisma.leaveGroup.findFirst({
      where: {
        id: { not: id },
        OR: [...(code ? [{ code }] : []), ...(name ? [{ name }] : [])],
      },
      select: { id: true, code: true },
    })
    if (existing) {
      return NextResponse.json(
        { error: code && existing.code === code ? "Leave group code already exists." : "Leave group name already exists." },
        { status: 409 }
      )
    }
  }

  try {
    const item = await prisma.$transaction(async (tx) => {
      const assignmentMode = parsed.data.assignmentMode ?? current.assignmentMode
      await tx.leaveGroup.update({
        where: { id },
        data: {
          ...(code ? { code } : {}),
          ...(name ? { name } : {}),
          ...(parsed.data.description !== undefined
            ? { description: parsed.data.description.trim() || null }
            : {}),
          ...(parsed.data.assignmentMode ? { assignmentMode: parsed.data.assignmentMode } : {}),
          ...(parsed.data.status ? { status: parsed.data.status } : {}),
          ...(typeof parsed.data.sortOrder === "number" ? { sortOrder: parsed.data.sortOrder } : {}),
        },
      })

      if (parsed.data.leaveDefinitionIds) {
        await replaceGroupLeaves(tx, id, parsed.data.leaveDefinitionIds)
      }
      if (parsed.data.staffIds || parsed.data.assignmentMode) {
        await replaceGroupStaffAssignments(
          tx,
          id,
          assignmentMode,
          parsed.data.staffIds ?? []
        )
      }

      return tx.leaveGroup.findUniqueOrThrow({
        where: { id },
        select: leaveGroupSelect,
      })
    })

    return NextResponse.json({ item: serializeLeaveGroup(item) })
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "Unable to update leave group." }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const role = (session?.user as { role?: string })?.role
  if (!session?.user || !canManageUsers(role as Role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const exists = await prisma.leaveGroup.findUnique({ where: { id }, select: { id: true } })
  if (!exists) {
    return NextResponse.json({ error: "Leave group not found." }, { status: 404 })
  }

  await prisma.leaveGroup.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
