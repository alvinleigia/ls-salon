import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { canManageUsers, type Role } from "@/lib/permissions"
import { updateSupplierSchema } from "@/lib/validation"

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
  const parsed = updateSupplierSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const data = parsed.data
  const supplier = await prisma.supplier.update({
    where: { id },
    data: {
      ...(data.name?.trim() ? { name: data.name.trim() } : {}),
      ...(data.contactPerson !== undefined
        ? { contactPerson: data.contactPerson?.trim() || null }
        : {}),
      ...(data.email !== undefined ? { email: data.email?.trim() || null } : {}),
      ...(data.phone !== undefined ? { phone: data.phone?.trim() || null } : {}),
      ...(data.isTaxRegistered !== undefined ? { isTaxRegistered: data.isTaxRegistered } : {}),
      ...(data.taxRegistrationType !== undefined
        ? { taxRegistrationType: data.taxRegistrationType || null }
        : {}),
      ...(data.taxRegistrationNumber !== undefined
        ? { taxRegistrationNumber: data.taxRegistrationNumber?.trim() || null }
        : {}),
      ...(typeof data.leadTimeDays === "number" ? { leadTimeDays: data.leadTimeDays } : {}),
      ...(data.addressLine1 !== undefined
        ? { addressLine1: data.addressLine1?.trim() || null }
        : {}),
      ...(data.addressLine2 !== undefined
        ? { addressLine2: data.addressLine2?.trim() || null }
        : {}),
      ...(data.city !== undefined ? { city: data.city?.trim() || null } : {}),
      ...(data.state !== undefined ? { state: data.state?.trim() || null } : {}),
      ...(data.postalCode !== undefined
        ? { postalCode: data.postalCode?.trim() || null }
        : {}),
      ...(data.country !== undefined ? { country: data.country?.trim() || null } : {}),
      ...(data.notes !== undefined ? { notes: data.notes?.trim() || null } : {}),
      ...(data.status ? { status: data.status } : {}),
    },
    select: {
      id: true,
      name: true,
      contactPerson: true,
      email: true,
      phone: true,
      isTaxRegistered: true,
      taxRegistrationType: true,
      taxRegistrationNumber: true,
      leadTimeDays: true,
      status: true,
      city: true,
      state: true,
      country: true,
      createdAt: true,
    },
  })

  return NextResponse.json({
    item: {
      ...supplier,
      createdAt: supplier.createdAt.toISOString(),
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
  const linkedProducts = await prisma.inventoryProductSupplier.count({
    where: { supplierId: id },
  })
  const linkedPurchases = await prisma.purchaseOrder.count({
    where: { supplierId: id },
  })

  if (linkedProducts > 0 || linkedPurchases > 0) {
    await prisma.supplier.update({
      where: { id },
      data: { status: "INACTIVE" },
    })
  } else {
    await prisma.supplier.delete({ where: { id } })
  }

  return NextResponse.json({ ok: true })
}
