import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { z } from "zod"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { canManageUsers, type Role } from "@/lib/permissions"
import { createSupplierSchema, supplierStatusSchema } from "@/lib/validation"

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(["createdAt", "name", "status"]).optional(),
  order: z.enum(["asc", "desc"]).optional(),
  q: z.string().trim().optional(),
  status: supplierStatusSchema.optional(),
})

const ensureAuthorized = async () => {
  const session = await auth()
  const role = (session?.user as { role?: string })?.role
  if (!session?.user || !canManageUsers(role as Role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  return null
}

export async function GET(request: Request) {
  const unauthorized = await ensureAuthorized()
  if (unauthorized) return unauthorized

  const url = new URL(request.url)
  const parsed = listSchema.safeParse(Object.fromEntries(url.searchParams.entries()))
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid pagination parameters.", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { page, pageSize, sort, order, q, status } = parsed.data
  const skip = (page - 1) * pageSize
  const orderBy = sort
    ? { [sort]: order ?? "asc" }
    : { name: "asc" as const }

  const where: Prisma.SupplierWhereInput = {
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { contactPerson: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { phone: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(status ? { status } : {}),
  }

  const [total, items] = await prisma.$transaction([
    prisma.supplier.count({ where }),
    prisma.supplier.findMany({
      where,
      orderBy,
      skip,
      take: pageSize,
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
    }),
  ])

  return NextResponse.json({
    items: items.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
    })),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  })
}

export async function POST(request: Request) {
  const unauthorized = await ensureAuthorized()
  if (unauthorized) return unauthorized

  const body = await request.json()
  const parsed = createSupplierSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const data = parsed.data
  const supplier = await prisma.supplier.create({
    data: {
      name: data.name.trim(),
      contactPerson: data.contactPerson?.trim() || undefined,
      email: data.email?.trim() || undefined,
      phone: data.phone?.trim() || undefined,
      isTaxRegistered: data.isTaxRegistered ?? false,
      taxRegistrationType: data.isTaxRegistered ? data.taxRegistrationType : null,
      taxRegistrationNumber: data.isTaxRegistered
        ? data.taxRegistrationNumber?.trim() || undefined
        : undefined,
      leadTimeDays: data.leadTimeDays ?? 0,
      addressLine1: data.addressLine1?.trim() || undefined,
      addressLine2: data.addressLine2?.trim() || undefined,
      city: data.city?.trim() || undefined,
      state: data.state?.trim() || undefined,
      postalCode: data.postalCode?.trim() || undefined,
      country: data.country?.trim() || undefined,
      notes: data.notes?.trim() || undefined,
      status: data.status ?? "ACTIVE",
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

  return NextResponse.json(
    {
      item: {
        ...supplier,
        createdAt: supplier.createdAt.toISOString(),
      },
    },
    { status: 201 }
  )
}
