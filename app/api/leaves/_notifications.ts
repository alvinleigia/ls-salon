import { Prisma, Role, type PrismaClient } from "@prisma/client"

import {
  leaveRequestApprovedEmail,
  leaveRequestCanceledEmail,
  leaveRequestRejectedEmail,
  leaveRequestSubmittedEmail,
} from "@/lib/emails/leave-events"
import { mailFrom, mailer } from "@/lib/mailer"

type DbClient = PrismaClient | Prisma.TransactionClient

type LeaveRequestNotificationPayload = {
  leaveCode: string
  leaveName: string
  startDateIso: string
  endDateIso: string
  daysCount: number
}

const canSendEmail = () => Boolean(mailFrom && process.env.SMTP_HOST)

const sendEmail = async (to: string, template: { subject: string; text: string; html: string }) => {
  if (!canSendEmail()) return
  await mailer.sendMail({
    from: mailFrom,
    to,
    subject: template.subject,
    text: template.text,
    html: template.html,
  })
}

export const notifyLeaveSubmitted = async (
  tx: DbClient,
  payload: LeaveRequestNotificationPayload & { staffUserId: string }
) => {
  if (!canSendEmail()) return
  const staffUser = await tx.user.findUnique({
    where: { id: payload.staffUserId },
    select: {
      role: true,
      staffProfile: { select: { managerUserId: true } },
    },
  })
  if (!staffUser) return

  const recipients = new Set<string>()
  const admins = await tx.user.findMany({
    where: { status: "ACTIVE", role: Role.ADMIN },
    select: { email: true },
  })
  admins.forEach((admin) => recipients.add(admin.email))

  if (staffUser.role === Role.STAFF && staffUser.staffProfile?.managerUserId) {
    const manager = await tx.user.findUnique({
      where: { id: staffUser.staffProfile.managerUserId },
      select: { email: true, status: true, role: true },
    })
    if (manager && manager.status === "ACTIVE" && manager.role === Role.MANAGER) {
      recipients.add(manager.email)
    }
  }

  const template = leaveRequestSubmittedEmail({
    leaveCode: payload.leaveCode,
    leaveName: payload.leaveName,
    startDate: payload.startDateIso,
    endDate: payload.endDateIso,
    daysCount: payload.daysCount,
  })
  await Promise.allSettled(Array.from(recipients).map((email) => sendEmail(email, template)))
}

export const notifyLeaveReviewed = async (
  tx: DbClient,
  params: LeaveRequestNotificationPayload & {
    staffUserId: string
    status: "APPROVED" | "REJECTED"
    reviewerName: string | null
    reviewerComment: string | null
  }
) => {
  if (!canSendEmail()) return
  const staffUser = await tx.user.findUnique({
    where: { id: params.staffUserId },
    select: { email: true, name: true },
  })
  if (!staffUser) return

  const template =
    params.status === "APPROVED"
      ? leaveRequestApprovedEmail({
          recipientName: staffUser.name,
          leaveCode: params.leaveCode,
          leaveName: params.leaveName,
          startDate: params.startDateIso,
          endDate: params.endDateIso,
          daysCount: params.daysCount,
          actorName: params.reviewerName,
          comment: params.reviewerComment,
        })
      : leaveRequestRejectedEmail({
          recipientName: staffUser.name,
          leaveCode: params.leaveCode,
          leaveName: params.leaveName,
          startDate: params.startDateIso,
          endDate: params.endDateIso,
          daysCount: params.daysCount,
          actorName: params.reviewerName,
          comment: params.reviewerComment,
        })

  await sendEmail(staffUser.email, template)
}

export const notifyLeaveCanceled = async (
  tx: DbClient,
  params: LeaveRequestNotificationPayload & {
    staffUserId: string
    canceledByUserId: string
    cancelReason: string | null
    canceledByName: string | null
  }
) => {
  if (!canSendEmail()) return

  const isSelfCancel = params.staffUserId === params.canceledByUserId
  if (isSelfCancel) {
    const reviewers = await tx.user.findMany({
      where: {
        status: "ACTIVE",
        role: { in: [Role.ADMIN, Role.MANAGER] },
      },
      select: { email: true },
    })
    const template = leaveRequestCanceledEmail({
      leaveCode: params.leaveCode,
      leaveName: params.leaveName,
      startDate: params.startDateIso,
      endDate: params.endDateIso,
      daysCount: params.daysCount,
      actorName: params.canceledByName,
      comment: params.cancelReason,
    })
    await Promise.allSettled(reviewers.map((reviewer) => sendEmail(reviewer.email, template)))
    return
  }

  const staffUser = await tx.user.findUnique({
    where: { id: params.staffUserId },
    select: { email: true },
  })
  if (!staffUser) return
  const template = leaveRequestCanceledEmail({
    leaveCode: params.leaveCode,
    leaveName: params.leaveName,
    startDate: params.startDateIso,
    endDate: params.endDateIso,
    daysCount: params.daysCount,
    actorName: params.canceledByName,
    comment: params.cancelReason,
  })
  await sendEmail(staffUser.email, template)
}
