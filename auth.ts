import NextAuth from "next-auth"
import bcrypt from "bcryptjs"
import Credentials from "next-auth/providers/credentials"

import { prisma, runWithRlsBypassDbContext, runWithTenantDbContext } from "@/lib/prisma"
import { resolvePlatformConsoleAccess } from "@/lib/platform-console"
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

          const platformAccess = await runWithRlsBypassDbContext(async () =>
            resolvePlatformConsoleAccess({
              tenantId: user.tenantId,
              role: user.role,
              sessionUserId: user.id,
            })
          )

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
            role: user.role,
            tenantId: user.tenantId,
            tenantSlug: tenant.slug,
            platformAccessMode: platformAccess?.mode ?? null,
            organizationIds: platformAccess?.organizationIds ?? [],
            organizationRolesById: platformAccess?.organizationRolesById ?? {},
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
        token.tenantSlug = (user as { tenantSlug?: string }).tenantSlug
        token.platformAccessMode = (user as { platformAccessMode?: string | null }).platformAccessMode
        token.organizationIds = (user as { organizationIds?: string[] }).organizationIds ?? []
        token.organizationRolesById = (user as { organizationRolesById?: Record<string, string> }).organizationRolesById ?? {}
      } else if (token.tenantId && !token.tenantSlug) {
        const tenant = await prisma.tenant.findUnique({
          where: { id: token.tenantId as string },
          select: { slug: true },
        })
        token.tenantSlug = tenant?.slug
      } else if (token.tenantId && token.platformAccessMode === undefined) {
        const platformAccess = await runWithRlsBypassDbContext(async () =>
          resolvePlatformConsoleAccess({
            tenantId: token.tenantId as string,
            role: token.role as string | null,
            sessionUserId: token.sub ?? null,
          })
        )
        token.platformAccessMode = platformAccess?.mode ?? null
        token.organizationIds = platformAccess?.organizationIds ?? []
        token.organizationRolesById = platformAccess?.organizationRolesById ?? {}
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
        ;(session.user as { tenantSlug?: string }).tenantSlug = token.tenantSlug as
          | string
          | undefined
        ;(session.user as { platformAccessMode?: string | null }).platformAccessMode =
          (token.platformAccessMode as string | null | undefined) ?? null
        ;(session.user as { organizationIds?: string[] }).organizationIds =
          (token.organizationIds as string[] | undefined) ?? []
        ;(session.user as { organizationRolesById?: Record<string, string> }).organizationRolesById =
          (token.organizationRolesById as Record<string, string> | undefined) ?? {}
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
