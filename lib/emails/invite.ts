type InviteEmailArgs = {
  inviteUrl: string
}

export function inviteEmail({ inviteUrl }: InviteEmailArgs) {
  const text = `You've been invited to join LS Salon. Set your password: ${inviteUrl}`
  const html = `<p>You've been invited to join LS Salon.</p><p><a href="${inviteUrl}">Set your password</a></p>`

  return {
    subject: "You've been invited to LS Salon",
    text,
    html,
  }
}
