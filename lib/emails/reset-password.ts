type ResetPasswordEmailArgs = {
  resetUrl: string
}

export function resetPasswordEmail({ resetUrl }: ResetPasswordEmailArgs) {
  const text = `Reset your password: ${resetUrl}`
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5;">
      <h2>Reset your password</h2>
      <p>We received a request to reset your password.</p>
      <p>
        <a href="${resetUrl}" style="display:inline-block;padding:10px 16px;background:#111;color:#fff;text-decoration:none;border-radius:6px;">
          Reset password
        </a>
      </p>
      <p>This link expires in 1 hour. If you didn't request this, ignore this email.</p>
    </div>
  `

  return {
    subject: "Reset your password",
    text,
    html,
  }
}
