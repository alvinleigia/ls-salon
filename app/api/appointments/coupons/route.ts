import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { z } from "zod"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { canManageUsers, type Role } from "@/lib/permissions"
import { couponCreateSchema } from "@/lib/validation"
import type { ListResponse } from "@/types/api"
import type { CouponRow } from "@/types/appointments"

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().optional(),
  active: z
    .string()
    .optional()
    .transform((value) => (value === undefined ? undefined : value === "true")),
})

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
  usedCount: coupon.usedCount,
  createdAt: coupon.createdAt.toISOString(),
  updatedAt: coupon.updatedAt.toISOString(),
})

export async function GET(request: Request) {
  const unauthorized = await ensureAuthorized()
  if (unauthorized) return unauthorized

  const url = new URL(request.url)
  const parsed = listSchema.safeParse(Object.fromEntries(url.searchParams.entries()))
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query parameters.", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { page, pageSize, q, active } = parsed.data
  const where: Prisma.CouponWhereInput = {}
  if (q) {
    where.OR = [
      { code: { contains: q, mode: "insensitive" } },
      { name: { contains: q, mode: "insensitive" } },
    ]
  }
  if (active !== undefined) {
    where.isActive = active
  }

  const skip = (page - 1) * pageSize
  const [total, items] = await prisma.$transaction([
    prisma.coupon.count({ where }),
    prisma.coupon.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip,
      take: pageSize,
    }),
  ])

  const response: ListResponse<CouponRow> = {
    items: items.map(serializeCoupon),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  }

  return NextResponse.json(response)
}

export async function POST(request: Request) {
  const unauthorized = await ensureAuthorized()
  if (unauthorized) return unauthorized

  const payload = await request.json()
  const parsed = couponCreateSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const data = parsed.data
  const code = data.code.toUpperCase()
  const validFrom = data.validFrom ? new Date(`${data.validFrom}T00:00:00.000Z`) : null
  const validTo = data.validTo ? new Date(`${data.validTo}T00:00:00.000Z`) : null
  if (validFrom && validTo && validFrom > validTo) {
    return NextResponse.json({ error: "Valid from must be before valid to." }, { status: 400 })
  }

  const coupon = await prisma.coupon.create({
    data: {
      code,
      name: data.name?.trim() || null,
      discountType: data.discountType,
      discountValue: data.discountValue,
      appliesTo: data.appliesTo,
      allowedServiceIds: data.allowedServiceIds,
      allowedCategoryIds: data.allowedCategoryIds,
      allowedProductIds: data.allowedProductIds,
      minSubtotalCents: data.minSubtotalCents,
      stackingMode: data.stackingMode,
      isActive: data.isActive ?? true,
      validFrom,
      validTo,
      maxUses: data.maxUses ?? null,
    } as unknown as Prisma.CouponUncheckedCreateInput,
  })

  return NextResponse.json({ coupon: serializeCoupon(coupon) }, { status: 201 })
}
