import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { canManageUsers, type Role } from "@/lib/permissions"
import { mailer, mailFrom } from "@/lib/mailer"
import { buildAppointmentOrderInvoicePdf } from "@/lib/invoice"
import { appointmentOrderInclude, serializeAppointmentOrder } from "../../_helpers"

export const runtime = "nodejs"

export async function POST(
  _request: Request,
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
  if (!order.customer?.email) {
    return NextResponse.json({ error: "Customer email not available." }, { status: 400 })
  }

  const settings = await prisma.appSetting.findUnique({
    where: { id: "global" },
    select: {
      locale: true,
      currency: true,
      currencySymbolPlacement: true,
      numberFormat: true,
      dateFormat: true,
      timeFormat: true,
    },
  })

  const pdf = await buildAppointmentOrderInvoicePdf({
    order: serializeAppointmentOrder(order),
    settings: settings ?? undefined,
  })

  const subject = `Invoice ${order.id.slice(-6)}`
  const customerName = order.customer?.name || "customer"
  const from = mailFrom || "no-reply@ls-salon.com"

  await mailer.sendMail({
    to: order.customer.email,
    from,
    subject,
    text: `Hi ${customerName},\n\nPlease find your invoice attached.\n\nThanks,\nLS Salon`,
    attachments: [
      {
        filename: `invoice-${order.id}.pdf`,
        content: pdf,
        contentType: "application/pdf",
      },
    ],
  })

  return NextResponse.json({ ok: true })
}
