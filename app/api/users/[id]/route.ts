import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { z } from "zod"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { updateUserSchema } from "@/lib/validation"
import { canManageUsers, type Role } from "@/lib/permissions"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await auth()
  const role = (session?.user as { role?: string })?.role
  const sessionUserId = (session?.user as { id?: string })?.id

  if (
    !session?.user ||
    (!canManageUsers(role as Role) && sessionUserId !== id)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const parsed = updateUserSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", details: parsed.error.flatten() },
      { status: 400 }
    )
  }
  const bodyData = parsed.data

  const data: {
    name?: string
    email?: string
    role?: "ADMIN" | "MANAGER" | "STAFF" | "CUSTOMER"
    passwordHash?: string
    phone?: string
    image?: string
    dateOfBirth?: Date
    gender?: "MALE" | "FEMALE" | "NON_BINARY" | "OTHER" | "PREFER_NOT_TO_SAY"
    status?: "ACTIVE" | "SUSPENDED" | "INVITED" | "ARCHIVED"
    marketingOptIn?: boolean
    addressLine1?: string
    addressLine2?: string
    city?: string
    state?: string
    postalCode?: string
    country?: string
  } = {}

  if (role === "ADMIN") {
    if (bodyData.name?.trim()) data.name = bodyData.name.trim()
    if (bodyData.email?.trim()) data.email = bodyData.email.trim().toLowerCase()
    if (bodyData.role) data.role = bodyData.role
    if (bodyData.password?.trim()) {
      data.passwordHash = await bcrypt.hash(bodyData.password.trim(), 10)
    }
    if (bodyData.phone?.trim()) data.phone = bodyData.phone.trim()
    if (bodyData.image?.trim()) data.image = bodyData.image.trim()
    if (bodyData.dateOfBirth) data.dateOfBirth = bodyData.dateOfBirth
    if (bodyData.gender) data.gender = bodyData.gender
    if (bodyData.status) data.status = bodyData.status
    if (typeof bodyData.marketingOptIn === "boolean") {
      data.marketingOptIn = bodyData.marketingOptIn
    }
    if (bodyData.addressLine1?.trim()) data.addressLine1 = bodyData.addressLine1.trim()
    if (bodyData.addressLine2?.trim()) data.addressLine2 = bodyData.addressLine2.trim()
    if (bodyData.city?.trim()) data.city = bodyData.city.trim()
    if (bodyData.state?.trim()) data.state = bodyData.state.trim()
    if (bodyData.postalCode?.trim()) data.postalCode = bodyData.postalCode.trim()
    if (bodyData.country?.trim()) data.country = bodyData.country.trim()
  } else if (sessionUserId === id) {
    if (bodyData.name?.trim()) data.name = bodyData.name.trim()
    if (bodyData.phone?.trim()) data.phone = bodyData.phone.trim()
    if (bodyData.image?.trim()) data.image = bodyData.image.trim()
    if (bodyData.dateOfBirth) data.dateOfBirth = bodyData.dateOfBirth
    if (bodyData.gender) data.gender = bodyData.gender
    if (typeof bodyData.marketingOptIn === "boolean") {
      data.marketingOptIn = bodyData.marketingOptIn
    }
    if (bodyData.addressLine1?.trim()) data.addressLine1 = bodyData.addressLine1.trim()
    if (bodyData.addressLine2?.trim()) data.addressLine2 = bodyData.addressLine2.trim()
    if (bodyData.city?.trim()) data.city = bodyData.city.trim()
    if (bodyData.state?.trim()) data.state = bodyData.state.trim()
    if (bodyData.postalCode?.trim()) data.postalCode = bodyData.postalCode.trim()
    if (bodyData.country?.trim()) data.country = bodyData.country.trim()
  } else {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await prisma.user.update({
    where: { id },
    data,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      createdAt: true,
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
    },
  })

  return NextResponse.json({ user })
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await auth()
  const role = (session?.user as { role?: string })?.role
  const sessionUserId = (session?.user as { id?: string })?.id

  if (
    !session?.user ||
    (!canManageUsers(role as Role) && sessionUserId !== id)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      image: true,
      role: true,
      status: true,
      gender: true,
      dateOfBirth: true,
      marketingOptIn: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      state: true,
      postalCode: true,
      country: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 })
  }

  return NextResponse.json({ user })
}
