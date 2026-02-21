import type { NextRequest } from "next/server"

import { handlers } from "@/auth"
import {
  createApiLogContext,
  logApiRequestError,
  logApiRequestStart,
  logApiRequestSuccess,
} from "@/lib/api-logging"

export const runtime = "nodejs"

export const GET = async (request: NextRequest, context: unknown) => {
  const logContext = createApiLogContext(request)
  logApiRequestStart(logContext, request)
  try {
    const _ = context
    const response = await handlers.GET(request)
    response.headers.set("x-request-id", logContext.requestId)
    logApiRequestSuccess(logContext, response.status)
    return response
  } catch (error) {
    logApiRequestError(logContext, error, 500)
    throw error
  }
}

export const POST = async (request: NextRequest, context: unknown) => {
  const logContext = createApiLogContext(request)
  logApiRequestStart(logContext, request)
  try {
    const _ = context
    const response = await handlers.POST(request)
    response.headers.set("x-request-id", logContext.requestId)
    logApiRequestSuccess(logContext, response.status)
    return response
  } catch (error) {
    logApiRequestError(logContext, error, 500)
    throw error
  }
}
