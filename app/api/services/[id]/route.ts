import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { updateServiceSchema } from "@/lib/validation"
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
  const parsed = updateServiceSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const data = parsed.data

  const item = await prisma.service.update({
    where: { id },
    data: {
      ...(data.name?.trim() ? { name: data.name.trim() } : {}),
      ...(data.description?.trim()
        ? { description: data.description.trim() }
        : data.description === ""
          ? { description: null }
          : {}),
      ...(data.categoryId ? { categoryId: data.categoryId } : {}),
      ...(typeof data.durationMinutes === "number"
        ? { durationMinutes: data.durationMinutes }
        : {}),
      ...(typeof data.priceCents === "number" ? { priceCents: data.priceCents } : {}),
      ...(data.status ? { status: data.status } : {}),
    },
    select: {
      id: true,
      name: true,
      description: true,
      durationMinutes: true,
      priceCents: true,
      status: true,
      createdAt: true,
      category: { select: { id: true, name: true } },
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

  await prisma.service.update({
    where: { id },
    data: { status: "INACTIVE" },
  })

  return NextResponse.json({ ok: true })
}
