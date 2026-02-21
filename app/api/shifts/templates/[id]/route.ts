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
import { shiftTemplateSchema } from "@/lib/validation"
import { canManageUsers, type Role } from "@/lib/permissions"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const logContext = createApiLogContext(request)
  logApiRequestStart(logContext, request)

  const { id } = await params
  const session = await auth()
  const role = (session?.user as { role?: string })?.role

  if (!session?.user || !canManageUsers(role as Role)) {
    const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    logApiRequestSuccess(logContext, 401, { reason: "unauthorized", templateId: id })
    return withRequestId(response, logContext.requestId)
  }

  const body = await request.json().catch(() => null)
  if (!body) {
    const response = NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
    logApiRequestSuccess(logContext, 400, { reason: "invalid_json", templateId: id })
    return withRequestId(response, logContext.requestId)
  }
  const parsed = shiftTemplateSchema.safeParse(body)
  if (!parsed.success) {
    const response = NextResponse.json(
      { error: "Invalid input.", details: parsed.error.flatten() },
      { status: 400 }
    )
    logApiRequestSuccess(logContext, 400, { reason: "validation_failed", templateId: id })
    return withRequestId(response, logContext.requestId)
  }

  try {
    const data = parsed.data
    const template = await prisma.$transaction(async (tx) => {
      const updated = await tx.shiftTemplate.update({
        where: { id },
        data: {
          name: data.name,
          description: data.description || null,
          color: data.color || null,
          isActive: data.isActive ?? true,
          startTime: data.startTime,
          endTime: data.endTime,
        },
      })
      await tx.shiftTemplateBreak.deleteMany({ where: { templateId: id } })
      if (data.breaks.length) {
        await tx.shiftTemplateBreak.createMany({
          data: data.breaks.map((period, index) => ({
            templateId: id,
            startTime: period.startTime,
            endTime: period.endTime,
            sortOrder: period.sortOrder ?? index,
          })),
        })
      }
      return updated
    })

    const withBreaks = await prisma.shiftTemplate.findUnique({
      where: { id: template.id },
      include: { breaks: { orderBy: { sortOrder: "asc" } } },
    })

    const response = NextResponse.json({ template: withBreaks })
    logApiRequestSuccess(logContext, 200, { templateId: id })
    return withRequestId(response, logContext.requestId)
  } catch (error) {
    logApiRequestError(logContext, error, 500, { templateId: id })
    const response = NextResponse.json({ error: "Unable to update shift template." }, { status: 500 })
    return withRequestId(response, logContext.requestId)
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const logContext = createApiLogContext(request)
  logApiRequestStart(logContext, request)

  const { id } = await params
  const session = await auth()
  const role = (session?.user as { role?: string })?.role

  if (!session?.user || !canManageUsers(role as Role)) {
    const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    logApiRequestSuccess(logContext, 401, { reason: "unauthorized", templateId: id })
    return withRequestId(response, logContext.requestId)
  }

  try {
    const [scheduleBlocks, overrides] = await Promise.all([
      prisma.shiftScheduleBlock.count({ where: { templateId: id } }),
      prisma.staffShiftOverride.count({ where: { templateId: id } }),
    ])
    if (scheduleBlocks > 0 || overrides > 0) {
      const response = NextResponse.json(
        { error: "Template is in use and cannot be deleted." },
        { status: 409 }
      )
      logApiRequestSuccess(logContext, 409, { reason: "template_in_use", templateId: id })
      return withRequestId(response, logContext.requestId)
    }

    await prisma.shiftTemplate.delete({ where: { id } })
    const response = NextResponse.json({ ok: true })
    logApiRequestSuccess(logContext, 200, { templateId: id, result: "deleted" })
    return withRequestId(response, logContext.requestId)
  } catch (error) {
    logApiRequestError(logContext, error, 500, { templateId: id })
    const response = NextResponse.json({ error: "Unable to delete shift template." }, { status: 500 })
    return withRequestId(response, logContext.requestId)
  }
}
