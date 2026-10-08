import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;
const ROLE_REFRESH_MS = 5 * 60 * 1000;
const DUMMY_HASH = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  jwt: { maxAge: 8 * 60 * 60 },
  pages: { signIn: "/admin/login" },
  trustHost: true,
  providers: [
    // Connexion directe par lien à usage unique (envoyé par WhatsApp). Le jeton est stocké haché,
    // avec le préfixe « login: » pour ne jamais pouvoir servir de lien de réinitialisation.
    Credentials({
      id: "magic",
      credentials: { token: { label: "Jeton", type: "text" } },
      authorize: async (credentials) => {
        const token = String(credentials?.token ?? "");
        if (token.length < 20 || token.length > 200) return null;
        const tokenHash = createHash("sha256").update(`login:${token}`).digest("hex");
        const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash }, include: { user: true } });
        if (!record || record.expiresAt <= new Date()) return null;
        // Usage unique : la suppression atomique garantit qu'un seul appel réussit.
        const consumed = await prisma.passwordResetToken.deleteMany({ where: { id: record.id } });
        if (consumed.count !== 1) return null;
        const u = record.user;
        return { id: u.id, email: u.email, name: u.name, role: u.role };
      },
    }),
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
    jwt: async ({ token, user }) => {
      const now = Date.now();
      if (user) {
        token.role = (user as { role: string }).role;
        token.id = user.id;
        token.checkedAt = now;
        return token;
      }
      // Le rôle est relu en base toutes les 5 minutes : un compte supprimé est déconnecté et un
      // changement de rôle prend effet sans attendre l'expiration de la session (8 h).
      const checkedAt = typeof token.checkedAt === "number" ? token.checkedAt : 0;
      if (token.id && now - checkedAt > ROLE_REFRESH_MS) {
        try {
          const fresh = await prisma.user.findUnique({ where: { id: token.id as string }, select: { role: true } });
          if (!fresh) return null;
          token.role = fresh.role;
          token.checkedAt = now;
        } catch {
          // Base momentanément indisponible : on garde le rôle connu et on réessaiera.
        }
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
