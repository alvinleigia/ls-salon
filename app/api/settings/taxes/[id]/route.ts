import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { canManageUsers, type Role } from "@/lib/permissions"
import { taxUpdateSchema } from "@/lib/validation"
import type { TaxRow } from "@/types/scheduling"

const ensureAuthorized = async () => {
  const session = await auth()
  const role = (session?.user as { role?: string })?.role
  if (!session?.user || !canManageUsers(role as Role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  return null
}

const serializeTax = (tax: {
  id: string
  name: string
  percent: number
  isActive: boolean
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}): TaxRow => ({
  id: tax.id,
  name: tax.name,
  percent: tax.percent,
  isActive: tax.isActive,
  sortOrder: tax.sortOrder,
  createdAt: tax.createdAt.toISOString(),
  updatedAt: tax.updatedAt.toISOString(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await ensureAuthorized()
  if (unauthorized) return unauthorized

  const { id } = await params
  const payload = await request.json()
  const parsed = taxUpdateSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const data = parsed.data
  const tax = await prisma.tax.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.percent !== undefined ? { percent: data.percent } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
    },
  })

  return NextResponse.json({ tax: serializeTax(tax) })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await ensureAuthorized()
  if (unauthorized) return unauthorized

  const { id } = await params

  const inUse = await prisma.appointmentOrderTax.findFirst({
    where: { taxId: id },
    select: { id: true },
  })
  if (inUse) {
    return NextResponse.json(
      { error: "Tax cannot be deleted because it is used in booking orders." },
      { status: 409 }
    )
  }

  await prisma.tax.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
