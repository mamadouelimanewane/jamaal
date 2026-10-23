/**
 * Lien d'installation de l'application envoyé aux revendeurs et livreurs DÉJÀ inscrits (les nouveaux le reçoivent
 * dans leur message de bienvenue). Un seul envoi par membre ; respecte le STOP. Ne lève jamais d'erreur.
 */
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/site-url";
import { phoneOptedOut } from "@/lib/phone-match";
import { sendWhatsApp } from "./index";

/** Texte et bouton (pur, testé). */
export function installInviteMessage(name: string, site: string, role: "revendeur" | "livreur" = "revendeur") {
  const first = name.trim().split(/\s+/)[0] || name;
  return {
    text: [
      `Bonjour ${first} 👋`,
      `L'application JAMAAL est disponible : installez-la sur votre téléphone pour ouvrir votre espace ${role} d'un seul geste, avec l'icône JAMAAL.`,
      `📲 C'est ici (1 minute, gratuit, sans Play Store ni App Store) : ${site}/admin/installer`,
      "Connectez-vous ensuite avec votre numéro WhatsApp et votre mot de passe habituels.",
    ].join("\n"),
    cta: { label: "Installer l'application", url: `${site}/admin/installer` },
  };
}

type Member = { key: string; name: string; phone: string; role: "revendeur" | "livreur" };

async function membersToInvite(includeLivreurs: boolean): Promise<Member[]> {
  const [consultants, livreurs, sent] = await Promise.all([
    prisma.consultant.findMany({ where: { active: true, whatsapp: { not: "" } }, select: { id: true, name: true, whatsapp: true } }),
    includeLivreurs ? prisma.livreur.findMany({ where: { active: true }, select: { id: true, name: true, phone: true } }) : Promise.resolve([]),
    prisma.automationSent.findMany({ where: { key: { startsWith: "installer:" } }, select: { key: true } }),
  ]);
  const done = new Set(sent.map((s) => s.key));
  return [
    ...consultants.filter((c) => c.whatsapp).map((c) => ({ key: `installer:c:${c.id}`, name: c.name, phone: c.whatsapp, role: "revendeur" as const })),
    ...livreurs.filter((l) => l.phone).map((l) => ({ key: `installer:l:${l.id}`, name: l.name, phone: l.phone, role: "livreur" as const })),
  ].filter((m) => !done.has(m.key));
}

/** Nombre de membres qui n'ont pas encore reçu le lien. */
export async function pendingInstallInvites(includeLivreurs = true): Promise<number> {
  return (await membersToInvite(includeLivreurs).catch(() => [])).length;
}

async function sendAll(members: Member[]) {
  const site = (await getSiteUrl().catch(() => "")).replace(/\/$/, "") || "https://www.jamaal.sn";
  for (const m of members) {
    try {
      if (await phoneOptedOut(m.phone)) continue;
      // Réservé d'abord : deux clics simultanés n'envoient pas deux messages.
      try {
        await prisma.automationSent.create({ data: { key: m.key } });
      } catch {
        continue;
      }
      const msg = installInviteMessage(m.name, site, m.role);
      const res = await sendWhatsApp({ to: m.phone, kind: m.role === "livreur" ? "livreur" : "reseller", text: msg.text, cta: msg.cta });
      if (res.status === "ECHEC") await prisma.automationSent.delete({ where: { key: m.key } }).catch(() => null);
    } catch (e) {
      console.error("[whatsapp] lien d'installation", m.key, e);
    }
  }
}

/** Envoie le lien à tous ceux qui ne l'ont pas encore reçu, après la réponse (la page ne reste pas bloquée). */
export async function inviteMembersToInstall(includeLivreurs = true): Promise<number> {
  const members = await membersToInvite(includeLivreurs);
  try {
    after(() => sendAll(members));
  } catch {
    void sendAll(members);
  }
  return members.length;
}
