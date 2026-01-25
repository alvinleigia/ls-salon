import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { appSettingsSchema } from "@/lib/validation"
import { canManageUsers, type Role } from "@/lib/permissions"

const SETTINGS_ID = "global"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await auth()
  const role = (session?.user as { role?: string })?.role

  if (!session?.user || !canManageUsers(role as Role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const settings = await prisma.appSetting.findUnique({
    where: { id: SETTINGS_ID },
  })

  if (settings) {
    return NextResponse.json({ settings })
  }

  const created = await prisma.appSetting.create({
    data: { id: SETTINGS_ID },
  })

  return NextResponse.json({ settings: created })
}

export async function PATCH(request: Request) {
  const session = await auth()
  const role = (session?.user as { role?: string })?.role

  if (!session?.user || !canManageUsers(role as Role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const parsed = appSettingsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const settings = await prisma.appSetting.upsert({
    where: { id: SETTINGS_ID },
    update: parsed.data,
    create: { id: SETTINGS_ID, ...parsed.data },
  })

  return NextResponse.json({ settings })
}
