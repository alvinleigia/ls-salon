import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { z } from "zod"

import {
  createApiLogContext,
  logApiRequestError,
  logApiRequestStart,
  logApiRequestSuccess,
  withRequestId,
} from "@/lib/api-logging"
import { prisma } from "@/lib/prisma"
import { signUpSchema } from "@/lib/validation"
import { resolveTenantFromRequest } from "@/lib/tenancy"

export async function POST(request: Request) {
  const logContext = createApiLogContext(request)
  logApiRequestStart(logContext, request)

  try {
    const tenant = await resolveTenantFromRequest(request)
    if (!tenant) {
      const response = NextResponse.json({ error: "Tenant not found." }, { status: 404 })
      logApiRequestSuccess(logContext, 404, { reason: "tenant_not_found" })
      return withRequestId(response, logContext.requestId)
    }

    const body = await request.json().catch(() => null)
    if (!body) {
      const response = NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
      logApiRequestSuccess(logContext, 400, { reason: "invalid_json" })
      return withRequestId(response, logContext.requestId)
    }

    const parsed = signUpSchema.safeParse(body)
    if (!parsed.success) {
      const response = NextResponse.json(
        { error: "Invalid input.", details: parsed.error.flatten() },
        { status: 400 }
      )
      logApiRequestSuccess(logContext, 400, { reason: "validation_failed" })
      return withRequestId(response, logContext.requestId)
    }

    const {
      name,
      email,
      password,
      phone,
      image,
      dateOfBirth,
      gender,
      marketingOptIn,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      country,
    } = parsed.data

    if (!email || !password) {
      const response = NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      )
      logApiRequestSuccess(logContext, 400, { reason: "missing_email_or_password" })
      return withRequestId(response, logContext.requestId)
    }

    const existing = await prisma.user.findFirst({ where: { email, tenantId: tenant.id } })
    if (existing) {
      const response = NextResponse.json(
        { error: "Email already in use." },
        { status: 409 }
      )
      logApiRequestSuccess(logContext, 409, { reason: "email_in_use" })
      return withRequestId(response, logContext.requestId)
    }

    const passwordHash = await bcrypt.hash(password, 10)

    await prisma.user.create({
      data: {
        tenantId: tenant.id,
        name: name || undefined,
        email,
        passwordHash,
        phone: phone || undefined,
        image: image || undefined,
        dateOfBirth,
        gender,
        marketingOptIn: marketingOptIn ?? false,
        addressLine1: addressLine1 || undefined,
        addressLine2: addressLine2 || undefined,
        city: city || undefined,
        state: state || undefined,
        postalCode: postalCode || undefined,
        country: country || undefined,
      },
    })

    const response = NextResponse.json({ ok: true })
    logApiRequestSuccess(logContext, 200, { result: "signup_created" })
    return withRequestId(response, logContext.requestId)
  } catch (error) {
    if (error instanceof z.ZodError) {
      const response = NextResponse.json(
        { error: "Invalid input.", details: error.flatten() },
        { status: 400 }
      )
      logApiRequestSuccess(logContext, 400, { reason: "zod_error" })
      return withRequestId(response, logContext.requestId)
    }
    logApiRequestError(logContext, error, 500)
    const response = NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    )
    return withRequestId(response, logContext.requestId)
  }
}
