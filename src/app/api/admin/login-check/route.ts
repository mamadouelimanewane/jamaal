import { prisma } from "@/lib/prisma";
import { requireAdminForApi } from "@/lib/api-guard";
import { phoneTail } from "@/lib/phone-match";
import { canonicalizePhone } from "@/lib/phone";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/login-check : peut-on se connecter avec chaque compte revendeur / livreur ?
 * Lecture seule : aucun mot de passe n'est lu ni renvoyé (seulement « défini ou non »).
 */
export async function GET() {
  const forbidden = await requireAdminForApi();
  if (forbidden) return forbidden;
  const [consultants, livreurs, users, locks] = await Promise.all([
    prisma.consultant.findMany({ select: { id: true, name: true, whatsapp: true, email: true, active: true, user: { select: { id: true, email: true, phone: true, createdAt: true } } } }),
    prisma.livreur.findMany({ select: { id: true, name: true, phone: true, active: true, user: { select: { id: true, email: true, phone: true } } } }),
    prisma.user.findMany({ select: { id: true, phone: true, role: true } }),
    prisma.loginAttempt.findMany({ where: { lockedUntil: { gt: new Date() } }, select: { identifiant: true, lockedUntil: true } }),
  ]);
  const activated = new Set(
    (await prisma.activityLog.findMany({ where: { action: "Réinitialisation du mot de passe" }, select: { userId: true } })).map((a) => a.userId)
  );
  const pendingLinks = new Set((await prisma.passwordResetToken.findMany({ where: { expiresAt: { gt: new Date() } }, select: { userId: true } })).map((t) => t.userId));
  // Numéros partagés par plusieurs fiches ou comptes : risque de connexion au mauvais compte.
  const tails = new Map<string, string[]>();
  const add = (raw: string | null | undefined, who: string) => {
    const t = phoneTail(raw ?? "");
    if (t) tails.set(t, [...new Set([...(tails.get(t) ?? []), who])]);
  };
  for (const c of consultants) add(c.whatsapp, `revendeur ${c.name}`);
  for (const l of livreurs) add(l.phone, `livreur ${l.name}`);
  for (const u of users) if (u.role !== "CONSULTANT" && u.role !== "LIVREUR") add(u.phone, `compte ${u.role}`);
  const locked = new Set(locks.map((l) => l.identifiant));

  const rows = [
    ...consultants.map((c) => ({ type: "revendeur", nom: c.name, actif: c.active, numero: c.whatsapp, user: c.user, emailFiche: c.email })),
    ...livreurs.map((l) => ({ type: "livreur", nom: l.name, actif: l.active, numero: l.phone, user: l.user, emailFiche: null })),
  ].map((r) => {
    const tail = phoneTail(r.numero);
    const problems: string[] = [];
    if (!r.actif) problems.push("fiche inactive");
    if (!r.user) problems.push("aucun compte de connexion : créer l'accès");
    if (!tail) problems.push("numéro WhatsApp invalide sur la fiche");
    if (tail && (tails.get(tail)?.length ?? 0) > 1) problems.push(`numéro partagé avec : ${tails.get(tail)!.filter((w) => !w.endsWith(r.nom)).join(", ")}`);
    if (r.user && !activated.has(r.user.id)) problems.push(pendingLinks.has(r.user.id) ? "mot de passe pas encore choisi (lien d'activation valable en attente)" : "à vérifier : aucun mot de passe choisi via un lien JAMAAL et aucun lien valable (s'il ne se connecte pas, envoyez-lui un lien)");
    const ids = [r.user?.email, r.numero && canonicalizePhone(r.numero), r.user?.phone].filter(Boolean) as string[];
    if (ids.some((i) => locked.has(i.toLowerCase()) || locked.has(i))) problems.push("bloqué (trop d'essais) : « Débloquer la connexion »");
    return { type: r.type, nom: r.nom, seConnecteAvec: [tail ? `numéro ${r.numero}` : null, r.user?.email ? `e-mail ${r.user.email}` : null].filter(Boolean).join(" ou "), ok: problems.length === 0, problemes: problems };
  });
  return Response.json({ total: rows.length, ok: rows.filter((r) => r.ok).length, aCorriger: rows.filter((r) => !r.ok), bloquesEnCours: locks.length });
}
