import { NextResponse } from "next/server"

import { auth } from "@/auth"
import {
  createApiLogContext,
  logApiRequestError,
  logApiRequestStart,
  logApiRequestSuccess,
  withRequestId,
} from "@/lib/api-logging"
import { canManageUsers, type Role } from "@/lib/permissions"
import { prisma } from "@/lib/prisma"
import { updateLeaveDefinitionSchema } from "@/lib/validation"
import {
  leaveDefinitionSelect,
  replaceNonClubbableRules,
  serializeLeaveDefinition,
} from "../../_definitions"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const logContext = createApiLogContext(request)
  logApiRequestStart(logContext, request)

  const session = await auth()
  const role = (session?.user as { role?: string })?.role
  if (!session?.user || !canManageUsers(role as Role)) {
    const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    logApiRequestSuccess(logContext, 401, { reason: "unauthorized" })
    return withRequestId(response, logContext.requestId)
  }

  try {
    const { id } = await params
    const item = await prisma.leaveDefinition.findUnique({
      where: { id },
      select: leaveDefinitionSelect,
    })
    if (!item) {
      const response = NextResponse.json({ error: "Leave definition not found." }, { status: 404 })
      logApiRequestSuccess(logContext, 404, { reason: "not_found", itemId: id })
      return withRequestId(response, logContext.requestId)
    }
    const response = NextResponse.json({ item: serializeLeaveDefinition(item) })
    logApiRequestSuccess(logContext, 200, { itemId: id })
    return withRequestId(response, logContext.requestId)
  } catch (error) {
    logApiRequestError(logContext, error, 500)
    const response = NextResponse.json({ error: "Unable to load leave definition." }, { status: 500 })
    return withRequestId(response, logContext.requestId)
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const logContext = createApiLogContext(request)
  logApiRequestStart(logContext, request)

  const session = await auth()
  const role = (session?.user as { role?: string })?.role
  if (!session?.user || !canManageUsers(role as Role)) {
    const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    logApiRequestSuccess(logContext, 401, { reason: "unauthorized" })
    return withRequestId(response, logContext.requestId)
  }

  try {
    const { id } = await params
    const current = await prisma.leaveDefinition.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        name: true,
        minDaysPerRequest: true,
        maxDaysPerRequest: true,
        maxConsecutiveDays: true,
      },
    })
    if (!current) {
      const response = NextResponse.json({ error: "Leave definition not found." }, { status: 404 })
      logApiRequestSuccess(logContext, 404, { reason: "not_found", itemId: id })
      return withRequestId(response, logContext.requestId)
    }

    const payload = await request.json().catch(() => ({}))
    const parsed = updateLeaveDefinitionSchema.safeParse(payload)
    if (!parsed.success) {
      const response = NextResponse.json(
        { error: "Invalid input.", details: parsed.error.flatten() },
        { status: 400 }
      )
      logApiRequestSuccess(logContext, 400, { reason: "validation_failed" })
      return withRequestId(response, logContext.requestId)
    }

    const nextMin = parsed.data.minDaysPerRequest ?? current.minDaysPerRequest
    const nextMax = parsed.data.maxDaysPerRequest ?? current.maxDaysPerRequest
    const nextMaxConsecutive = parsed.data.maxConsecutiveDays ?? current.maxConsecutiveDays
    if (nextMin > nextMax) {
      const response = NextResponse.json(
        { error: "Minimum days must be less than or equal to maximum days." },
        { status: 400 }
      )
      logApiRequestSuccess(logContext, 400, { reason: "invalid_day_range" })
      return withRequestId(response, logContext.requestId)
    }
    if (nextMaxConsecutive > nextMax) {
      const response = NextResponse.json(
        { error: "Max consecutive days cannot be more than max days per request." },
        { status: 400 }
      )
      logApiRequestSuccess(logContext, 400, { reason: "invalid_max_consecutive" })
      return withRequestId(response, logContext.requestId)
    }

    const code = parsed.data.code?.trim().toUpperCase()
    const name = parsed.data.name?.trim()
    if (code || name) {
      const duplicate = await prisma.leaveDefinition.findFirst({
        where: {
          id: { not: id },
          OR: [
            ...(code ? [{ code }] : []),
            ...(name ? [{ name }] : []),
          ],
        },
        select: { id: true, code: true, name: true },
      })
      if (duplicate) {
        const response = NextResponse.json(
          {
            error:
              code && duplicate.code === code
                ? "Leave code already exists."
                : "Leave name already exists.",
          },
          { status: 409 }
        )
        logApiRequestSuccess(logContext, 409, { reason: "duplicate_code_or_name" })
        return withRequestId(response, logContext.requestId)
      }
    }

    const item = await prisma.$transaction(async (tx) => {
      await tx.leaveDefinition.update({
        where: { id },
        data: {
          ...(code ? { code } : {}),
          ...(name ? { name } : {}),
          ...(parsed.data.leaveType ? { leaveType: parsed.data.leaveType } : {}),
          ...(parsed.data.allowedUsers ? { allowedUsers: parsed.data.allowedUsers } : {}),
          ...(typeof parsed.data.minDaysPerRequest === "number"
            ? { minDaysPerRequest: parsed.data.minDaysPerRequest }
            : {}),
          ...(typeof parsed.data.maxDaysPerRequest === "number"
            ? { maxDaysPerRequest: parsed.data.maxDaysPerRequest }
            : {}),
          ...(typeof parsed.data.allowWithOtherLeaves === "boolean"
            ? { allowWithOtherLeaves: parsed.data.allowWithOtherLeaves }
            : {}),
          ...(typeof parsed.data.priorEntryAllowed === "boolean"
            ? { priorEntryAllowed: parsed.data.priorEntryAllowed }
            : {}),
          ...(typeof parsed.data.noticeDays === "number"
            ? { noticeDays: parsed.data.noticeDays }
            : {}),
          ...(typeof parsed.data.allowCarryForward === "boolean"
            ? { allowCarryForward: parsed.data.allowCarryForward }
            : {}),
          ...(typeof parsed.data.weekOffSingleSideAllowed === "boolean"
            ? { weekOffSingleSideAllowed: parsed.data.weekOffSingleSideAllowed }
            : {}),
          ...(typeof parsed.data.weekOffBothSideAllowed === "boolean"
            ? { weekOffBothSideAllowed: parsed.data.weekOffBothSideAllowed }
            : {}),
          ...(typeof parsed.data.holidaySingleSideAllowed === "boolean"
            ? { holidaySingleSideAllowed: parsed.data.holidaySingleSideAllowed }
            : {}),
          ...(typeof parsed.data.holidayBothSideAllowed === "boolean"
            ? { holidayBothSideAllowed: parsed.data.holidayBothSideAllowed }
            : {}),
          ...(typeof parsed.data.maxConsecutiveDays === "number"
            ? { maxConsecutiveDays: parsed.data.maxConsecutiveDays }
            : {}),
          ...(typeof parsed.data.maxPendingRequests === "number"
            ? { maxPendingRequests: parsed.data.maxPendingRequests }
            : {}),
          ...(parsed.data.status ? { status: parsed.data.status } : {}),
          ...(typeof parsed.data.sortOrder === "number" ? { sortOrder: parsed.data.sortOrder } : {}),
        },
      })
      if (parsed.data.nonClubbableWithIds) {
        await replaceNonClubbableRules(tx, id, parsed.data.nonClubbableWithIds)
      }
      return tx.leaveDefinition.findUniqueOrThrow({
        where: { id },
        select: leaveDefinitionSelect,
      })
    })
    const response = NextResponse.json({ item: serializeLeaveDefinition(item) })
    logApiRequestSuccess(logContext, 200, { itemId: id })
    return withRequestId(response, logContext.requestId)
  } catch (error) {
    if (error instanceof Error) {
      const response = NextResponse.json({ error: error.message }, { status: 400 })
      logApiRequestSuccess(logContext, 400, { reason: "domain_error", message: error.message })
      return withRequestId(response, logContext.requestId)
    }
    logApiRequestError(logContext, error, 500)
    const response = NextResponse.json({ error: "Unable to update leave definition." }, { status: 500 })
    return withRequestId(response, logContext.requestId)
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const logContext = createApiLogContext(request)
  logApiRequestStart(logContext, request)

  const session = await auth()
  const role = (session?.user as { role?: string })?.role
  if (!session?.user || !canManageUsers(role as Role)) {
    const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    logApiRequestSuccess(logContext, 401, { reason: "unauthorized" })
    return withRequestId(response, logContext.requestId)
  }

  try {
    const { id } = await params
    const exists = await prisma.leaveDefinition.findUnique({
      where: { id },
      select: { id: true },
    })
    if (!exists) {
      const response = NextResponse.json({ error: "Leave definition not found." }, { status: 404 })
      logApiRequestSuccess(logContext, 404, { reason: "not_found", itemId: id })
      return withRequestId(response, logContext.requestId)
    }

    await prisma.leaveDefinition.delete({ where: { id } })
    const response = NextResponse.json({ ok: true })
    logApiRequestSuccess(logContext, 200, { itemId: id })
    return withRequestId(response, logContext.requestId)
  } catch (error) {
    logApiRequestError(logContext, error, 500)
    const response = NextResponse.json({ error: "Unable to delete leave definition." }, { status: 500 })
    return withRequestId(response, logContext.requestId)
  }
}
