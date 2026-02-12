import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { canManageUsers, type Role } from "@/lib/permissions"
import { couponUpdateSchema } from "@/lib/validation"
import type { CouponRow } from "@/types/appointments"

const ensureAuthorized = async () => {
  const session = await auth()
  const role = (session?.user as { role?: string })?.role
  if (!session?.user || !canManageUsers(role as Role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  return null
}

const serializeCoupon = (coupon: {
  id: string
  code: string
  name: string | null
  discountType: "NONE" | "PERCENT" | "AMOUNT"
  discountValue: number
  appliesTo?: "ORDER" | "SERVICE_LINES" | "PRODUCT_LINES"
  allowedServiceIds?: string[]
  allowedCategoryIds?: string[]
  allowedProductIds?: string[]
  minSubtotalCents?: number
  stackingMode?: "STACKABLE" | "EXCLUSIVE"
  isActive: boolean
  validFrom: Date | null
  validTo: Date | null
  maxUses: number | null
  maxUsesPerCustomer: number | null
  usedCount: number
  createdAt: Date
  updatedAt: Date
}): CouponRow => ({
  id: coupon.id,
  code: coupon.code,
  name: coupon.name,
  discountType: coupon.discountType,
  discountValue: coupon.discountValue,
  appliesTo: coupon.appliesTo ?? "ORDER",
  allowedServiceIds: coupon.allowedServiceIds ?? [],
  allowedCategoryIds: coupon.allowedCategoryIds ?? [],
  allowedProductIds: coupon.allowedProductIds ?? [],
  minSubtotalCents: coupon.minSubtotalCents ?? 0,
  stackingMode: coupon.stackingMode ?? "STACKABLE",
  isActive: coupon.isActive,
  validFrom: coupon.validFrom ? coupon.validFrom.toISOString().slice(0, 10) : null,
  validTo: coupon.validTo ? coupon.validTo.toISOString().slice(0, 10) : null,
  maxUses: coupon.maxUses,
  maxUsesPerCustomer: coupon.maxUsesPerCustomer,
  usedCount: coupon.usedCount,
  createdAt: coupon.createdAt.toISOString(),
  updatedAt: coupon.updatedAt.toISOString(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await ensureAuthorized()
  if (unauthorized) return unauthorized

  const { id } = await params
  const payload = await request.json()
  const parsed = couponUpdateSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const data = parsed.data
  const validFrom =
    data.validFrom === undefined
      ? undefined
      : data.validFrom
        ? new Date(`${data.validFrom}T00:00:00.000Z`)
        : null
  const validTo =
    data.validTo === undefined
      ? undefined
      : data.validTo
        ? new Date(`${data.validTo}T00:00:00.000Z`)
        : null

  if (
    validFrom !== undefined &&
    validTo !== undefined &&
    validFrom !== null &&
    validTo !== null &&
    validFrom > validTo
  ) {
    return NextResponse.json({ error: "Valid from must be before valid to." }, { status: 400 })
  }

  const coupon = await prisma.coupon.update({
    where: { id },
    data: {
      ...(data.code !== undefined ? { code: data.code.toUpperCase() } : {}),
      ...(data.name !== undefined ? { name: data.name?.trim() || null } : {}),
      ...(data.discountType !== undefined ? { discountType: data.discountType } : {}),
      ...(data.discountValue !== undefined ? { discountValue: data.discountValue } : {}),
      ...(data.appliesTo !== undefined ? { appliesTo: data.appliesTo } : {}),
      ...(data.allowedServiceIds !== undefined ? { allowedServiceIds: data.allowedServiceIds } : {}),
      ...(data.allowedCategoryIds !== undefined ? { allowedCategoryIds: data.allowedCategoryIds } : {}),
      ...(data.allowedProductIds !== undefined ? { allowedProductIds: data.allowedProductIds } : {}),
      ...(data.minSubtotalCents !== undefined ? { minSubtotalCents: data.minSubtotalCents } : {}),
      ...(data.stackingMode !== undefined ? { stackingMode: data.stackingMode } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      ...(validFrom !== undefined ? { validFrom } : {}),
      ...(validTo !== undefined ? { validTo } : {}),
      ...(data.maxUses !== undefined ? { maxUses: data.maxUses } : {}),
      ...(data.maxUsesPerCustomer !== undefined
        ? { maxUsesPerCustomer: data.maxUsesPerCustomer }
        : {}),
    } as unknown as Prisma.CouponUncheckedUpdateInput,
  })

  return NextResponse.json({ coupon: serializeCoupon(coupon) })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauthorized = await ensureAuthorized()
  if (unauthorized) return unauthorized
  const { id } = await params
  await prisma.coupon.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
