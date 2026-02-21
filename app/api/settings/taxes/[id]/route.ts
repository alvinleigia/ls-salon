import { NextResponse } from "next/server"

import { auth } from "@/auth"
import {
  createApiLogContext,
  logApiRequestError,
  logApiRequestStart,
  logApiRequestSuccess,
  withRequestId,
} from "@/lib/api-logging"
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
  const logContext = createApiLogContext(request)
  logApiRequestStart(logContext, request)

  const unauthorized = await ensureAuthorized()
  if (unauthorized) {
    logApiRequestSuccess(logContext, 401, { reason: "unauthorized" })
    return withRequestId(unauthorized, logContext.requestId)
  }

  const { id } = await params
  const payload = await request.json().catch(() => null)
  if (!payload) {
    const response = NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
    logApiRequestSuccess(logContext, 400, { reason: "invalid_json", taxId: id })
    return withRequestId(response, logContext.requestId)
  }
  const parsed = taxUpdateSchema.safeParse(payload)
  if (!parsed.success) {
    const response = NextResponse.json(
      { error: "Invalid input.", details: parsed.error.flatten() },
      { status: 400 }
    )
    logApiRequestSuccess(logContext, 400, { reason: "validation_failed", taxId: id })
    return withRequestId(response, logContext.requestId)
  }

  try {
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

    const response = NextResponse.json({ tax: serializeTax(tax) })
    logApiRequestSuccess(logContext, 200, { taxId: id })
    return withRequestId(response, logContext.requestId)
  } catch (error) {
    logApiRequestError(logContext, error, 500, { taxId: id })
    const response = NextResponse.json({ error: "Unable to update tax." }, { status: 500 })
    return withRequestId(response, logContext.requestId)
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const logContext = createApiLogContext(request)
  logApiRequestStart(logContext, request)

  const unauthorized = await ensureAuthorized()
  if (unauthorized) {
    logApiRequestSuccess(logContext, 401, { reason: "unauthorized" })
    return withRequestId(unauthorized, logContext.requestId)
  }

  const { id } = await params

  try {
    const inUse = await prisma.appointmentOrderTax.findFirst({
      where: { taxId: id },
      select: { id: true },
    })
    if (inUse) {
      const response = NextResponse.json(
        { error: "Tax cannot be deleted because it is used in booking orders." },
        { status: 409 }
      )
      logApiRequestSuccess(logContext, 409, { reason: "in_use", taxId: id })
      return withRequestId(response, logContext.requestId)
    }

    await prisma.tax.delete({ where: { id } })
    const response = NextResponse.json({ ok: true })
    logApiRequestSuccess(logContext, 200, { taxId: id, result: "deleted" })
    return withRequestId(response, logContext.requestId)
  } catch (error) {
    logApiRequestError(logContext, error, 500, { taxId: id })
    const response = NextResponse.json({ error: "Unable to delete tax." }, { status: 500 })
    return withRequestId(response, logContext.requestId)
  }
}
