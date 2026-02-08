import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { canManageUsers, type Role } from "@/lib/permissions"
import { buildAppointmentOrderInvoicePdf } from "@/lib/invoice"
import { appointmentOrderInclude, serializeAppointmentOrder } from "../../_helpers"

export const runtime = "nodejs"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  const role = (session?.user as { role?: string })?.role
  if (!session?.user || !canManageUsers(role as Role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const order = await prisma.appointmentOrder.findUnique({
    where: { id },
    include: appointmentOrderInclude,
  })
  if (!order) {
    return NextResponse.json({ error: "Appointment order not found." }, { status: 404 })
  }

  const settings = await prisma.appSetting.findUnique({
    where: { id: "global" },
    select: {
      locale: true,
      currency: true,
      currencySymbolPlacement: true,
      numberFormat: true,
    },
  })

  const pdf = await buildAppointmentOrderInvoicePdf({
    order: serializeAppointmentOrder(order),
    settings: settings ?? undefined,
  })

  const url = new URL(request.url)
  const download = url.searchParams.get("download") === "1"
  const disposition = download ? "attachment" : "inline"

  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename=\"invoice-${order.id}.pdf\"`,
    },
  })
}
