import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { parseLoginIdentifier } from "@/lib/login-identifier";
import { accountsByPhone } from "@/lib/staff-accounts";
import { canonicalizePhone } from "@/lib/phone";

const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;
const ROLE_REFRESH_MS = 5 * 60 * 1000;
/** Session de 30 jours : un revendeur sur smartphone ne doit pas se reconnecter chaque jour. */
const SESSION_MAX_AGE = 30 * 24 * 60 * 60;
const DUMMY_HASH = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE },
  jwt: { maxAge: SESSION_MAX_AGE },
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
        const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash }, include: { user: { include: { consultant: { select: { whatsapp: true } }, livreur: { select: { phone: true } } } } } });
        if (!record || record.expiresAt <= new Date()) return null;
        // Usage unique : la suppression atomique garantit qu'un seul appel réussit.
        const consumed = await prisma.passwordResetToken.deleteMany({ where: { id: record.id } });
        if (consumed.count !== 1) return null;
        const u = record.user;
        // Connexion réussie par lien : on lève un éventuel blocage après trop d'essais.
        const ids = [u.email?.toLowerCase(), u.phone, u.consultant?.whatsapp, u.livreur?.phone]
          .filter((v): v is string => !!v)
          .map((v) => (v.includes("@") ? v : canonicalizePhone(v)));
        if (ids.length) await prisma.loginAttempt.deleteMany({ where: { identifiant: { in: ids } } }).catch(() => {});
        return { id: u.id, email: u.email, phone: u.phone, name: u.name, role: u.role };
      },
    }),
    Credentials({
      credentials: {
        login: { label: "E-mail ou téléphone", type: "text" },
        password: { label: "Mot de passe", type: "password" },
      },
      authorize: async (credentials) => {
        const identifier = parseLoginIdentifier(String(credentials?.login ?? ""));
        const password = String(credentials?.password ?? "");
        if (!identifier || !password || password.length > 1024) return null;
        const identifiant = identifier.value;

        const now = new Date();
        const attempt = await prisma.loginAttempt.findUnique({ where: { identifiant } });
        if (attempt?.lockedUntil && attempt.lockedUntil > now) return null;

        // E-mail : le compte de cet e-mail. Téléphone : tous les comptes liés à ce numéro (compte,
        // fiche revendeur, fiche livreur ; voir staff-accounts.ts) — le premier dont le mot de
        // passe correspond gagne.
        const candidates =
          identifier.kind === "email"
            ? await prisma.user.findMany({ where: { email: { equals: identifiant, mode: "insensitive" } }, take: 2 })
            : await accountsByPhone(identifiant);
        // Tolérance smartphone : une espace ajoutée en fin de mot de passe par le clavier.
        const tries = password !== password.trim() ? [password, password.trim()] : [password];
        let user: (typeof candidates)[number] | null = null;
        for (const c of candidates) {
          for (const t of tries) if (!user && (await bcrypt.compare(t, c.passwordHash))) user = c;
        }
        if (!candidates.length) await bcrypt.compare(password, DUMMY_HASH);
        if (!user) {
          if (!candidates.length) return null;
          const expired = !attempt || now.getTime() - attempt.windowStart.getTime() > WINDOW_MS;
          const count = expired ? 1 : (attempt?.count ?? 0) + 1;
          const lockedUntil = count >= MAX_FAILURES ? new Date(now.getTime() + LOCK_MS) : null;
          await prisma.loginAttempt.upsert({
            where: { identifiant },
            create: { identifiant, count, windowStart: now, lockedUntil },
            update: { count, windowStart: expired ? now : attempt!.windowStart, lockedUntil },
          });
          return null;
        }

        await prisma.loginAttempt.deleteMany({ where: { identifiant } });
        return { id: user.id, email: user.email, phone: user.phone, name: user.name, role: user.role };
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      const now = Date.now();
      if (user) {
        token.role = (user as { role: string }).role;
        token.id = user.id;
        token.phone = (user as { phone?: string | null }).phone ?? null;
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
        session.user.phone = (token.phone as string | null | undefined) ?? null;
      }
      return session;
    },
  },
});
