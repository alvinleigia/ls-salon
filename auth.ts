import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import Credentials from "next-auth/providers/credentials";

import { prisma } from "@/lib/prisma";
import { resolveTenantFromHostHeader } from "@/lib/tenancy";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        const creds = credentials as { email?: string; password?: string } | undefined;
        const email = creds?.email?.trim().toLowerCase();
        const password = creds?.password?.trim();

        if (!email || !password) return null;

        const host =
          request?.headers?.get("x-forwarded-host") ??
          request?.headers?.get("host");
        const tenant = await resolveTenantFromHostHeader(host);
        if (!tenant) return null;

        const user = await prisma.user.findFirst({ where: { email, tenantId: tenant.id } });
        if (!user || !user.passwordHash) return null;
        if (!user.tenantId) return null;
        if (user.status === "ARCHIVED") return null;

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
          tenantId: user.tenantId,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/auth/signin" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role;
        token.tenantId = (user as { tenantId?: string }).tenantId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? session.user.id;
        (session.user as { role?: string }).role = token.role as string | undefined;
        (session.user as { tenantId?: string }).tenantId = token.tenantId as
          | string
          | undefined;
      }
      return session;
    },
    async signIn({ user }) {
      if (user?.id) {
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });
      }
      return true;
    },
  },
});
