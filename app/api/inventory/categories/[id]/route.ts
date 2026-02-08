import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { canManageUsers, type Role } from "@/lib/permissions"
import { updateInventoryCategorySchema } from "@/lib/validation"

const ensureAuthorized = async () => {
  const session = await auth()
  const role = (session?.user as { role?: string })?.role
  if (!session?.user || !canManageUsers(role as Role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  return null
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await ensureAuthorized()
  if (unauthorized) return unauthorized

  const { id } = await params
  const body = await request.json()
  const parsed = updateInventoryCategorySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const data = parsed.data
  if (data.name?.trim()) {
    const existing = await prisma.inventoryCategory.findUnique({
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

  const item = await prisma.inventoryCategory.update({
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

  return NextResponse.json({
    item: {
      ...item,
      createdAt: item.createdAt.toISOString(),
    },
  })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await ensureAuthorized()
  if (unauthorized) return unauthorized

  const { id } = await params
  const linkedProducts = await prisma.inventoryProduct.count({
    where: { categoryId: id },
  })

  if (linkedProducts > 0) {
    await prisma.inventoryCategory.update({
      where: { id },
      data: { status: "INACTIVE" },
    })
  } else {
    await prisma.inventoryCategory.delete({ where: { id } })
  }

  return NextResponse.json({ ok: true })
}
