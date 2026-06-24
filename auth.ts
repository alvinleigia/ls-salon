import NextAuth from "next-auth"
import bcrypt from "bcryptjs"
import Credentials from "next-auth/providers/credentials"

import { prisma, runWithTenantDbContext } from "@/lib/prisma"
import { resolveTenantFromHostHeader } from "@/lib/tenancy"

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        const creds = credentials as { email?: string; password?: string } | undefined
        const email = creds?.email?.trim().toLowerCase()
        const password = creds?.password?.trim()

        if (!email || !password) return null

        const host =
          request?.headers?.get("x-forwarded-host") ??
          request?.headers?.get("host")
        const tenant = await resolveTenantFromHostHeader(host)
        if (!tenant) return null

        return runWithTenantDbContext(tenant.id, async () => {
          const user = await prisma.user.findFirst({
            where: { email, tenantId: tenant.id },
          })
          if (!user || !user.passwordHash) return null
          if (!user.tenantId) return null
          if (user.status !== "ACTIVE") return null

          const isValid = await bcrypt.compare(password, user.passwordHash)
          if (!isValid) return null

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
            role: user.role,
            tenantId: user.tenantId,
          }
        })
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/auth/signin" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role
        token.tenantId = (user as { tenantId?: string }).tenantId
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? session.user.id
        ;(session.user as { role?: string }).role = token.role as string | undefined
        ;(session.user as { tenantId?: string }).tenantId = token.tenantId as
          | string
          | undefined
      }
      return session
    },
    async signIn({ user }) {
      const tenantId = (user as { tenantId?: string | null })?.tenantId ?? null
      if (user?.id && tenantId) {
        await runWithTenantDbContext(tenantId, async () => {
          await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          })
        })
      }
      return true
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`

      try {
        const target = new URL(url)
        const base = new URL(baseUrl)
        if (target.origin === base.origin) return url

        const targetHost = target.hostname.toLowerCase()
        const baseHost = base.hostname.toLowerCase()
        if (
          baseHost === "localhost" &&
          (targetHost === "localhost" || targetHost.endsWith(".localhost"))
        ) {
          return url
        }

        const rootDomain = process.env.APP_ROOT_DOMAIN?.trim().toLowerCase()
        if (rootDomain) {
          const sameRootDomain =
            (targetHost === rootDomain || targetHost.endsWith(`.${rootDomain}`)) &&
            (baseHost === rootDomain || baseHost.endsWith(`.${rootDomain}`))
          if (sameRootDomain) return url
        }
      } catch {
        return baseUrl
      }

      return baseUrl
    },
  },
})
