import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { updateServiceCategorySchema } from "@/lib/validation"
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
  const parsed = updateServiceCategorySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const data = parsed.data
  if (data.name?.trim()) {
    const existing = await prisma.serviceCategory.findUnique({
      where: { name: data.name.trim() },
      select: { id: true },
    })
    if (existing && existing.id !== id) {
      return NextResponse.json(
        { error: "Category name already exists." },
        { status: 409 }
      )
    }
  }

  const item = await prisma.serviceCategory.update({
    where: { id },
    data: {
      ...(data.name?.trim() ? { name: data.name.trim() } : {}),
      ...(data.description?.trim()
        ? { description: data.description.trim() }
        : data.description === ""
          ? { description: null }
          : {}),
      ...(data.status ? { status: data.status } : {}),
      ...(typeof data.sortOrder === "number" ? { sortOrder: data.sortOrder } : {}),
    },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      sortOrder: true,
      createdAt: true,
    },
  })

  return NextResponse.json({ item })
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

  const linkedServices = await prisma.service.count({
    where: { categoryId: id },
  })
  if (linkedServices > 0) {
    return NextResponse.json(
      {
        error: "Category is in use. Deactivate services or move them first.",
      },
      { status: 409 }
    )
  }

  await prisma.serviceCategory.update({
    where: { id },
    data: { status: "INACTIVE" },
  })

  return NextResponse.json({ ok: true })
}
