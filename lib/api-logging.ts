import { randomUUID } from "crypto"
import { NextResponse } from "next/server"

import { logger } from "@/lib/logger"

export type ApiLogContext = {
  requestId: string
  method: string
  path: string
  startedAt: number
}

const pickClientIp = (request: Request) => {
  const forwardedFor = request.headers.get("x-forwarded-for")
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || null
  }
  return request.headers.get("x-real-ip")
}

export const createApiLogContext = (request: Request): ApiLogContext => {
  const url = new URL(request.url)
  return {
    requestId: request.headers.get("x-request-id") ?? randomUUID(),
    method: request.method,
    path: url.pathname,
    startedAt: Date.now(),
  }
}

export const logApiRequestStart = (context: ApiLogContext, request: Request, extra?: Record<string, unknown>) => {
  logger.info("api.request.start", {
    requestId: context.requestId,
    method: context.method,
    path: context.path,
    ip: pickClientIp(request),
    userAgent: request.headers.get("user-agent"),
    ...extra,
  })
}

export const logApiRequestSuccess = (
  context: ApiLogContext,
  status: number,
  extra?: Record<string, unknown>
) => {
  logger.info("api.request.success", {
    requestId: context.requestId,
    method: context.method,
    path: context.path,
    status,
    durationMs: Date.now() - context.startedAt,
    ...extra,
  })
}

export const logApiRequestError = (
  context: ApiLogContext,
  error: unknown,
  status: number,
  extra?: Record<string, unknown>
) => {
  logger.error("api.request.error", {
    requestId: context.requestId,
    method: context.method,
    path: context.path,
    status,
    durationMs: Date.now() - context.startedAt,
    error,
    ...extra,
  })
}

export const withRequestId = <T>(response: NextResponse<T>, requestId: string) => {
  response.headers.set("x-request-id", requestId)
  return response
}

