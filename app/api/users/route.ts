import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { z } from "zod"

import { auth } from "@/auth"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { createUserSchema } from "@/lib/validation"
import { canInvite, canManageUsers, type Role } from "@/lib/permissions"

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  q: z.string().trim().optional(),
  role: z.enum(["ADMIN", "MANAGER", "STAFF", "CUSTOMER"]).optional(),
  status: z.enum(["ACTIVE", "SUSPENDED", "INVITED", "ARCHIVED"]).optional(),
  sortBy: z
    .enum(["createdAt", "name", "email", "phone", "role", "status", "lastLoginAt"])
    .optional(),
  sort: z
    .enum(["createdAt", "name", "email", "phone", "role", "status", "lastLoginAt"])
    .optional(),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  order: z.enum(["asc", "desc"]).optional(),
})

export async function GET(request: Request) {
  const session = await auth()
  const role = (session?.user as { role?: string })?.role

  if (!session?.user || !canManageUsers(role as Role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  const parsed = paginationSchema.safeParse(
    Object.fromEntries(url.searchParams.entries())
  )
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid pagination parameters." },
      { status: 400 }
    )
  }

  const {
    page,
    pageSize,
    search,
    q,
    role: roleFilter,
    status,
    sortBy,
    sort,
    sortDir,
    order,
  } = parsed.data
  const skip = (page - 1) * pageSize
  const trimmedSearch = (q ?? search)?.trim()
  const resolvedSortBy = sort ?? sortBy
  const resolvedSortDir = order ?? sortDir

  const where = {
    ...(roleFilter ? { role: roleFilter } : {}),
    ...(status ? { status } : {}),
    ...(trimmedSearch
      ? {
          OR: [
            { name: { contains: trimmedSearch, mode: Prisma.QueryMode.insensitive } },
            { email: { contains: trimmedSearch, mode: Prisma.QueryMode.insensitive } },
            { phone: { contains: trimmedSearch, mode: Prisma.QueryMode.insensitive } },
          ],
        }
      : {}),
  }

  const orderBy = resolvedSortBy
    ? { [resolvedSortBy]: resolvedSortDir }
    : { createdAt: "desc" as const }

  const [total, users] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        image: true,
        dateOfBirth: true,
        gender: true,
        status: true,
        lastLoginAt: true,
        marketingOptIn: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        state: true,
        postalCode: true,
        country: true,
        role: true,
        createdAt: true,
      },
      where,
      orderBy,
      skip,
      take: pageSize,
    }),
  ])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return NextResponse.json({
    items: users,
    page,
    pageSize,
    total,
    totalPages,
  })
}

export async function POST(request: Request) {
  const session = await auth()
  const role = (session?.user as { role?: string })?.role

  if (!session?.user || !canInvite(role as Role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const parsed = createUserSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const {
    name,
    email,
    password,
    role: userRole,
    phone,
    image,
    dateOfBirth,
    gender,
    status,
    eligibleServiceIds,
    marketingOptIn,
    addressLine1,
    addressLine2,
    city,
    state,
    postalCode,
    country,
  } = parsed.data

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json(
      { error: "Email already in use." },
      { status: 409 }
    )
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const normalizedEligibleServiceIds =
    userRole === "STAFF" && eligibleServiceIds
      ? Array.from(new Set(eligibleServiceIds))
      : []

  const user = await prisma.user.create({
    data: {
      name: name || undefined,
      email,
      passwordHash,
      role: userRole ?? "CUSTOMER",
      phone: phone || undefined,
      image: image || undefined,
      dateOfBirth,
      gender,
      status: status ?? "ACTIVE",
      marketingOptIn: userRole === "STAFF" ? false : marketingOptIn ?? false,
      addressLine1: addressLine1 || undefined,
      addressLine2: addressLine2 || undefined,
      city: city || undefined,
      state: state || undefined,
      postalCode: postalCode || undefined,
      country: country || undefined,
      eligibleServices: normalizedEligibleServiceIds.length
        ? {
            createMany: {
              data: normalizedEligibleServiceIds.map((serviceId) => ({ serviceId })),
            },
          }
        : undefined,
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      image: true,
      dateOfBirth: true,
      gender: true,
      status: true,
      lastLoginAt: true,
      marketingOptIn: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      state: true,
      postalCode: true,
      country: true,
      role: true,
      createdAt: true,
    },
  })

  return NextResponse.json({ user })
}
