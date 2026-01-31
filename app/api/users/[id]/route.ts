import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"

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

  const existingUser = await prisma.user.findUnique({
    where: { id },
    select: { role: true },
  })

  const targetRole = (bodyData.role ?? existingUser?.role ?? null) as Role | null

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
  const eligibleServiceIds = bodyData.eligibleServiceIds
  const staffProfileInput = bodyData.staffProfile

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
    if (bodyData.addressLine1?.trim()) data.addressLine1 = bodyData.addressLine1.trim()
    if (bodyData.addressLine2?.trim()) data.addressLine2 = bodyData.addressLine2.trim()
    if (bodyData.city?.trim()) data.city = bodyData.city.trim()
    if (bodyData.state?.trim()) data.state = bodyData.state.trim()
    if (bodyData.postalCode?.trim()) data.postalCode = bodyData.postalCode.trim()
    if (bodyData.country?.trim()) data.country = bodyData.country.trim()
  } else {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (targetRole === "STAFF") {
    data.marketingOptIn = false
  } else if (typeof bodyData.marketingOptIn === "boolean") {
    data.marketingOptIn = bodyData.marketingOptIn
  }

  const normalizedEligibleServiceIds =
    targetRole === "STAFF" && eligibleServiceIds
      ? Array.from(new Set(eligibleServiceIds))
      : null

  const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
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
        eligibleServices: { select: { serviceId: true } },
        staffProfile: {
          select: {
            documents: {
              select: {
                id: true,
                type: true,
                number: true,
                imageUrl: true,
                validFrom: true,
                validTo: true,
              },
            },
            shiftAssignments: {
              select: {
                id: true,
                day: true,
                templateId: true,
                template: { select: { id: true, name: true, color: true } },
              },
              orderBy: { day: "asc" },
            },
            shiftSchedule: {
              select: {
                id: true,
                name: true,
                startDate: true,
                weekOffDay1: true,
                weekOffDay2: true,
                weekOff2Weeks: true,
                blocks: {
                  select: {
                    id: true,
                    templateId: true,
                    repeatDays: true,
                    sortOrder: true,
                  },
                  orderBy: { sortOrder: "asc" },
                },
              },
            },
            certifications: {
              select: { id: true, title: true, issuer: true, issuedAt: true, expiresAt: true },
            },
          },
        },
      },
    })

    if (role === "ADMIN") {
      if (normalizedEligibleServiceIds !== null) {
        await tx.staffServiceEligibility.deleteMany({ where: { userId: id } })
        if (normalizedEligibleServiceIds.length) {
          await tx.staffServiceEligibility.createMany({
            data: normalizedEligibleServiceIds.map((serviceId) => ({
              userId: id,
              serviceId,
            })),
          })
        }
      } else if (targetRole && targetRole !== "STAFF" && bodyData.role) {
        await tx.staffServiceEligibility.deleteMany({ where: { userId: id } })
      }

      if (targetRole !== "STAFF" && bodyData.role) {
        await tx.staffProfile.deleteMany({ where: { userId: id } })
      }

      if (targetRole === "STAFF" && staffProfileInput) {
        const profile = await tx.staffProfile.upsert({
          where: { userId: id },
          update: {},
          create: { userId: id },
        })

        if (staffProfileInput.documents) {
          await tx.staffDocument.deleteMany({
            where: { staffProfileId: profile.id },
          })
          if (staffProfileInput.documents.length) {
            await tx.staffDocument.createMany({
              data: staffProfileInput.documents.map((doc) => ({
                staffProfileId: profile.id,
                type: doc.type,
                number: doc.number || null,
                imageUrl: doc.imageUrl,
                validFrom: doc.validFrom
                  ? new Date(`${doc.validFrom}T00:00:00.000Z`)
                  : null,
                validTo: doc.validTo
                  ? new Date(`${doc.validTo}T00:00:00.000Z`)
                  : null,
              })),
            })
          }
        }

        if (staffProfileInput.shiftAssignments) {
          await tx.staffShiftAssignment.deleteMany({
            where: { staffProfileId: profile.id },
          })
          if (staffProfileInput.shiftAssignments.length) {
            await tx.staffShiftAssignment.createMany({
              data: staffProfileInput.shiftAssignments.map((assignment) => ({
                staffProfileId: profile.id,
                day: assignment.day,
                templateId: assignment.templateId,
              })),
            })
          }
        }

        if (staffProfileInput.certifications) {
          await tx.staffCertification.deleteMany({
            where: { staffProfileId: profile.id },
          })
          if (staffProfileInput.certifications.length) {
            await tx.staffCertification.createMany({
              data: staffProfileInput.certifications.map((cert) => ({
                staffProfileId: profile.id,
                title: cert.title,
                issuer: cert.issuer || null,
                issuedAt: cert.issuedAt
                  ? new Date(`${cert.issuedAt}T00:00:00.000Z`)
                  : null,
                expiresAt: cert.expiresAt
                  ? new Date(`${cert.expiresAt}T00:00:00.000Z`)
                  : null,
              })),
            })
          }
        }
      }
    }

    return updated
  })

  return NextResponse.json({
    user: {
      ...user,
      eligibleServiceIds: user.eligibleServices.map((item) => item.serviceId),
    },
  })
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
    return NextResponse.json(
      { error: "Unauthorized. Please sign in and try again." },
      { status: 401 }
    )
  }

  const ensureStaffProfile = async () => {
    const target = await prisma.user.findUnique({
      where: { id },
      select: { role: true, staffProfile: { select: { id: true } } },
    })
    if (!target || target.role !== "STAFF" || target.staffProfile) {
      return
    }
    await prisma.staffProfile.create({ data: { userId: id } })
  }

  await ensureStaffProfile()

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
      eligibleServices: { select: { serviceId: true } },
      staffProfile: {
        select: {
          documents: {
            select: {
              id: true,
              type: true,
              number: true,
              imageUrl: true,
              validFrom: true,
              validTo: true,
            },
          },
          shiftAssignments: {
            select: {
              id: true,
              day: true,
              templateId: true,
              template: { select: { id: true, name: true, color: true } },
            },
            orderBy: { day: "asc" },
          },
          shiftSchedule: {
            select: {
              id: true,
              name: true,
              startDate: true,
              weekOffDay1: true,
              weekOffDay2: true,
              weekOff2Weeks: true,
              blocks: {
                select: {
                  id: true,
                  templateId: true,
                  repeatDays: true,
                  sortOrder: true,
                },
                orderBy: { sortOrder: "asc" },
              },
            },
          },
          certifications: {
            select: { id: true, title: true, issuer: true, issuedAt: true, expiresAt: true },
          },
        },
      },
    },
  })

  if (!user) {
    return NextResponse.json(
      { error: "User not found. Please refresh and try again." },
      { status: 404 }
    )
  }

  return NextResponse.json({
    user: {
      ...user,
      eligibleServiceIds: user.eligibleServices.map((item) => item.serviceId),
    },
  })
}
