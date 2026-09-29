import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;
const DUMMY_HASH = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  jwt: { maxAge: 8 * 60 * 60 },
  pages: { signIn: "/admin/login" },
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      authorize: async (credentials) => {
        const email = String(credentials?.email ?? "").trim().toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!email || !password || email.length > 254 || password.length > 1024) return null;

        const now = new Date();
        const attempt = await prisma.loginAttempt.findUnique({ where: { email } });
        if (attempt?.lockedUntil && attempt.lockedUntil > now) return null;

        const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
        const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
        if (!user) return null;
        if (!valid) {
          const expired = !attempt || now.getTime() - attempt.windowStart.getTime() > WINDOW_MS;
          const count = expired ? 1 : (attempt?.count ?? 0) + 1;
          const lockedUntil = count >= MAX_FAILURES ? new Date(now.getTime() + LOCK_MS) : null;
          await prisma.loginAttempt.upsert({
            where: { email },
            create: { email, count, windowStart: now, lockedUntil },
            update: { count, windowStart: expired ? now : attempt!.windowStart, lockedUntil },
          });
          return null;
        }

        await prisma.loginAttempt.deleteMany({ where: { email } });
        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  callbacks: {
    jwt: ({ token, user }) => {
      if (user) {
        token.role = (user as { role: string }).role;
        token.id = user.id;
      }
      return token;
    },
    session: ({ session, token }) => {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
});
