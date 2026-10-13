"use server";

import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseLoginIdentifier } from "@/lib/login-identifier";
import { clientIpFromHeaders, rateLimit } from "@/lib/rate-limit";
import { canonicalizePhone } from "@/lib/phone";
import { getSiteUrl } from "@/lib/site-url";
import { staffAccountByPhone } from "@/lib/staff-accounts";
import { sendWhatsApp, whatsappConfig } from "@/lib/whatsapp";

/** Pages de connexion autorisées (retour avec message). */
const BASES = new Set(["/admin/login", "/espace-revendeur"]);
const NEXTS = new Set(["/admin", "/livreur"]);

function base(formData: FormData) {
  const b = String(formData.get("from") ?? "");
  return BASES.has(b) ? b : "/admin/login";
}

/** Connexion par identifiant (numéro WhatsApp ou e-mail) et mot de passe, messages clairs. */
export async function passwordLogin(formData: FormData) {
  const from = base(formData);
  const login = String(formData.get("login") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const nextRaw = String(formData.get("next") ?? "");
  const redirectTo = NEXTS.has(nextRaw) ? nextRaw : "/admin";
  const keep = `${redirectTo !== "/admin" ? `&next=${encodeURIComponent(redirectTo)}` : ""}&id=${encodeURIComponent(login.slice(0, 80))}`;
  const id = parseLoginIdentifier(login);
  const lockedNow = async () => {
    if (!id) return false;
    const a = await prisma.loginAttempt.findUnique({ where: { identifiant: id.value } });
    return !!a?.lockedUntil && a.lockedUntil > new Date();
  };
  if (await lockedNow()) redirect(`${from}?erreur=bloque${keep}`);
  try {
    await signIn("credentials", { login, password, redirectTo });
  } catch (error) {
    if (error instanceof AuthError) redirect(`${from}?erreur=${(await lockedNow()) ? "bloque" : "1"}${keep}`);
    throw error;
  }
}

/**
 * Connexion sans mot de passe : un lien à usage unique (30 min) part sur le WhatsApp enregistré
 * du revendeur ou du livreur. Rien n'est envoyé à un autre numéro que celui de la fiche ; la
 * réponse affichée est la même que le numéro existe ou non.
 */
export async function whatsappLoginLink(formData: FormData) {
  const from = base(formData);
  const phone = String(formData.get("phone") ?? "").trim().slice(0, 30);
  const keep = `&id=${encodeURIComponent(phone)}`;
  if (phone.replace(/\D/g, "").length < 9) redirect(`${from}?lien=numero${keep}`);
  if (!whatsappConfig().active) redirect(`${from}?lien=indispo${keep}`);
  const ip = clientIpFromHeaders(await headers());
  const [byIp, byPhone] = await Promise.all([
    rateLimit(`login-link-ip:${ip}`, { limit: 8, windowMs: 3_600_000 }),
    rateLimit(`login-link:${canonicalizePhone(phone)}`, { limit: 3, windowMs: 3_600_000 }),
  ]);
  if (!byIp.ok || !byPhone.ok) redirect(`${from}?lien=attente${keep}`);
  const account = await staffAccountByPhone(phone);
  if (account?.whatsapp) {
    const token = randomBytes(32).toString("base64url");
    await prisma.passwordResetToken.create({
      data: { tokenHash: createHash("sha256").update(`login:${token}`).digest("hex"), userId: account.id, expiresAt: new Date(Date.now() + 30 * 60_000) },
    });
    const url = `${(await getSiteUrl()).replace(/\/$/, "")}/admin/acces?token=${encodeURIComponent(token)}`;
    await sendWhatsApp({
      to: canonicalizePhone(account.whatsapp),
      kind: "reseller",
      text: `Bonjour ${account.name.split(/\s+/)[0]}, voici votre lien pour ouvrir votre espace JAMAAL (valable 30 minutes, une seule fois). Si vous n'avez rien demandé, ignorez ce message.`,
      cta: { label: "Ouvrir mon espace", url },
    });
  }
  redirect(`${from}?lien=envoye${keep}`);
}
