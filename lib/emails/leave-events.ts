type LeaveEventEmailArgs = {
  recipientName?: string | null
  leaveCode: string
  leaveName: string
  startDate: string
  endDate: string
  daysCount: number
  actorName?: string | null
  comment?: string | null
}

const formatRecipient = (name?: string | null) => (name?.trim() ? name.trim() : "there")

const formatSummary = ({
  leaveCode,
  leaveName,
  startDate,
  endDate,
  daysCount,
}: LeaveEventEmailArgs) =>
  `${leaveCode} - ${leaveName} (${startDate} to ${endDate}, ${daysCount} day(s))`

export function leaveRequestSubmittedEmail(args: LeaveEventEmailArgs) {
  const summary = formatSummary(args)
  const text = `A leave request was submitted: ${summary}.`
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5;">
      <h2>New leave request submitted</h2>
      <p>A staff member submitted a leave request.</p>
      <p><strong>${summary}</strong></p>
    </div>
  `

  return {
    subject: "New leave request submitted",
    text,
    html,
  }
}

export function leaveRequestApprovedEmail(args: LeaveEventEmailArgs) {
  const summary = formatSummary(args)
  const actorText = args.actorName?.trim() ? ` by ${args.actorName.trim()}` : ""
  const commentText = args.comment?.trim() ? ` Comment: ${args.comment.trim()}` : ""
  const text = `Hi ${formatRecipient(args.recipientName)}, your leave request was approved${actorText}: ${summary}.${commentText}`
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5;">
      <h2>Leave request approved</h2>
      <p>Hi ${formatRecipient(args.recipientName)}, your leave request has been approved${actorText}.</p>
      <p><strong>${summary}</strong></p>
      ${args.comment?.trim() ? `<p>Comment: ${args.comment.trim()}</p>` : ""}
    </div>
  `

  return {
    subject: "Your leave request was approved",
    text,
    html,
  }
}

export function leaveRequestRejectedEmail(args: LeaveEventEmailArgs) {
  const summary = formatSummary(args)
  const actorText = args.actorName?.trim() ? ` by ${args.actorName.trim()}` : ""
  const commentText = args.comment?.trim() ? ` Comment: ${args.comment.trim()}` : ""
  const text = `Hi ${formatRecipient(args.recipientName)}, your leave request was rejected${actorText}: ${summary}.${commentText}`
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5;">
      <h2>Leave request rejected</h2>
      <p>Hi ${formatRecipient(args.recipientName)}, your leave request has been rejected${actorText}.</p>
      <p><strong>${summary}</strong></p>
      ${args.comment?.trim() ? `<p>Comment: ${args.comment.trim()}</p>` : ""}
    </div>
  `

  return {
    subject: "Your leave request was rejected",
    text,
    html,
  }
}

export function leaveRequestCanceledEmail(args: LeaveEventEmailArgs) {
  const summary = formatSummary(args)
  const actorText = args.actorName?.trim() ? ` by ${args.actorName.trim()}` : ""
  const commentText = args.comment?.trim() ? ` Reason: ${args.comment.trim()}` : ""
  const text = `Leave request canceled${actorText}: ${summary}.${commentText}`
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5;">
      <h2>Leave request canceled</h2>
      <p>A leave request has been canceled${actorText}.</p>
      <p><strong>${summary}</strong></p>
      ${args.comment?.trim() ? `<p>Reason: ${args.comment.trim()}</p>` : ""}
    </div>
  `

  return {
    subject: "Leave request canceled",
    text,
    html,
  }
}

export function leaveRequestRevokedEmail(args: LeaveEventEmailArgs) {
  const summary = formatSummary(args)
  const actorText = args.actorName?.trim() ? ` by ${args.actorName.trim()}` : ""
  const commentText = args.comment?.trim() ? ` Reason: ${args.comment.trim()}` : ""
  const text = `Hi ${formatRecipient(args.recipientName)}, your approved leave was revoked${actorText}: ${summary}.${commentText}`
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5;">
      <h2>Approved leave revoked</h2>
      <p>Hi ${formatRecipient(args.recipientName)}, your approved leave has been revoked${actorText}.</p>
      <p><strong>${summary}</strong></p>
      ${args.comment?.trim() ? `<p>Reason: ${args.comment.trim()}</p>` : ""}
    </div>
  `

  return {
    subject: "Your approved leave was revoked",
    text,
    html,
  }
}
