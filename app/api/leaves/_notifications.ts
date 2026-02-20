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
  payload: LeaveRequestNotificationPayload
) => {
  if (!canSendEmail()) return
  const reviewers = await tx.user.findMany({
    where: {
      status: "ACTIVE",
      role: { in: [Role.ADMIN, Role.MANAGER] },
    },
    select: { email: true },
  })
  const template = leaveRequestSubmittedEmail({
    leaveCode: payload.leaveCode,
    leaveName: payload.leaveName,
    startDate: payload.startDateIso,
    endDate: payload.endDateIso,
    daysCount: payload.daysCount,
  })
  await Promise.allSettled(reviewers.map((reviewer) => sendEmail(reviewer.email, template)))
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
