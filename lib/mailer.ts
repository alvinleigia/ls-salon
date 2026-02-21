import nodemailer from "nodemailer"
import { Prisma, type PrismaClient } from "@prisma/client"

const host = process.env.SMTP_HOST
const port = Number(process.env.SMTP_PORT ?? 587)
const user = process.env.SMTP_USER
const pass = process.env.SMTP_PASS

export const mailFrom = process.env.MAIL_FROM
const hasAuthPair = (user && pass) || (!user && !pass)
const smtpConfigured = Boolean(host && port && mailFrom && hasAuthPair)

export const mailer = nodemailer.createTransport({
  host,
  port,
  secure: port === 465,
  auth: user && pass ? { user, pass } : undefined,
})

const maskValue = (value: string | undefined) => {
  if (!value) return null
  if (value.length <= 4) return "*".repeat(value.length)
  return `${value.slice(0, 2)}${"*".repeat(Math.max(4, value.length - 4))}${value.slice(-2)}`
}

type DbClient = PrismaClient | Prisma.TransactionClient

export const getEmailDeliveryStatus = () => ({
  configured: smtpConfigured,
  host: host ?? null,
  port: Number.isFinite(port) ? port : null,
  from: mailFrom ?? null,
  usernameMasked: maskValue(user),
})

export const canSendConfiguredEmail = async (tx: DbClient) => {
  if (!smtpConfigured) return false
  const setting = await tx.appSetting.findUnique({
    where: { id: "global" },
    select: { emailNotificationsEnabled: true },
  })
  return Boolean(setting?.emailNotificationsEnabled)
}
