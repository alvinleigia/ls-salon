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

  if (data.type === "PACKAGE" && data.packageItemIds?.length === 0) {
    return NextResponse.json(
      { error: "Package items are required." },
      { status: 400 }
    )
  }

  const item = await prisma.$transaction(async (tx) => {
    const updated = await tx.service.update({
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
        ...(typeof data.priceCents === "number"
          ? { priceCents: data.priceCents }
          : {}),
        ...(data.status ? { status: data.status } : {}),
        ...(data.type ? { type: data.type } : {}),
        ...(data.taxMode ? { taxMode: data.taxMode } : {}),
        ...(data.taxIds
          ? {
              defaultTaxes: {
                deleteMany: {},
                create: [...new Set(data.taxIds)].map((taxId) => ({ taxId })),
              },
            }
          : {}),
      },
    })

    if (data.packageItemIds) {
      await tx.servicePackageItem.deleteMany({ where: { packageId: id } })
      if (data.packageItemIds.length > 0) {
        await tx.servicePackageItem.createMany({
          data: data.packageItemIds.map((itemServiceId, index) => ({
            packageId: id,
            itemServiceId,
            sortOrder: index,
          })),
        })
      }
    }

    return tx.service.findUnique({
      where: { id: updated.id },
      select: {
        id: true,
        name: true,
        description: true,
        durationMinutes: true,
        priceCents: true,
        status: true,
        type: true,
        taxMode: true,
        createdAt: true,
        category: { select: { id: true, name: true } },
        packageItems: {
          select: { itemService: { select: { id: true, name: true } } },
        },
        defaultTaxes: { select: { taxId: true } },
      },
    })
  })

  return NextResponse.json({
    item: item
      ? {
          ...item,
          taxIds: item.defaultTaxes.map((tax) => tax.taxId),
        }
      : null,
  })
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

  const associations = await prisma.servicePackageItem.count({
    where: {
      OR: [{ packageId: id }, { itemServiceId: id }],
    },
  })

  if (associations > 0) {
    await prisma.service.update({
      where: { id },
      data: { status: "INACTIVE" },
    })
  } else {
    await prisma.service.delete({ where: { id } })
  }

  return NextResponse.json({ ok: true })
}
