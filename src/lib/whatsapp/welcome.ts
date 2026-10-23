/**
 * Message de bienvenue WhatsApp : envoyé une seule fois à chaque nouveau revendeur, dès que sa
 * fiche est créée (candidature acceptée, fiche ou compte créé par l'admin). Respecte l'interrupteur
 * « Message de bienvenue » et le STOP du revendeur. Ne lève jamais d'erreur.
 * Le lien d'activation n'est volontairement pas envoyé ici : il est transmis par l'équipe (et par
 * e-mail) pour ne pas rester en clair dans le journal des messages.
 */
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/site-url";
import { automationEnabled } from "@/lib/automation-settings";
import { phoneOptedOut } from "@/lib/phone-match";
import { sendWhatsApp } from "./index";

/** Texte et bouton du message (pur, testé). */
export function welcomeMessage(
  r: { name: string; slug: string | null; sponsorName: string | null },
  site: string
): { text: string; cta: { label: string; url: string } } {
  const first = r.name.trim().split(/\s+/)[0] || r.name;
  const lines = [
    `Bienvenue chez JAMAAL, ${first} ! 🎉`,
    r.sponsorName ? `Vous rejoignez l'équipe de ${r.sponsorName}, revendeur officiel Chogan au Sénégal.` : "Vous êtes désormais revendeur officiel Chogan au Sénégal avec JAMAAL.",
    "",
    "Pour bien démarrer :",
    "1️⃣ Activez votre espace revendeur avec le lien d'activation qui vous est transmis par l'équipe (répondez ici s'il ne vous est pas parvenu).",
    r.slug && site ? `2️⃣ Partagez votre lien de vente personnel : ${site}/c/${r.slug}` : "2️⃣ Partagez votre lien de vente personnel dès l'activation.",
    "3️⃣ Suivez la formation et les défis dans votre espace.",
    site ? `📲 Installez l'application JAMAAL sur votre téléphone (icône sur l'écran d'accueil) : ${site}/admin/installer` : "",
    "",
    "Vous gagnez une commission sur chaque vente, et sur celles de votre équipe. Une question ? Répondez simplement à ce message.",
  ];
  return { text: lines.filter((l, i, a) => l !== "" || a[i - 1] !== "").join("\n"), cta: { label: "Installer l'application", url: `${site}/admin/installer` } };
}

/** Variables du modèle dédié « bienvenue_revendeur » : {{1}} prénom, {{2}} parrain, {{3}} lien de vente. */
export function welcomeTemplateVars(r: { name: string; slug: string | null; sponsorName: string | null }, site: string): string[] {
  const first = r.name.trim().split(/\s+/)[0] || r.name;
  return [first, r.sponsorName || "JAMAAL", r.slug && site ? `${site}/c/${r.slug}` : site || "www.jamaal.sn"];
}

export async function sendResellerWelcome(consultantId: string): Promise<void> {
  try {
    if (!(await automationEnabled("welcome"))) return;
    const c = await prisma.consultant.findUnique({
      where: { id: consultantId },
      select: { name: true, whatsapp: true, slug: true, active: true, sponsor: { select: { name: true } } },
    });
    if (!c?.active || !c.whatsapp || (await phoneOptedOut(c.whatsapp))) return;
    // Un seul message par revendeur, même si plusieurs chemins de création se croisent.
    try {
      await prisma.automationSent.create({ data: { key: `bienvenue:${consultantId}` } });
    } catch {
      return;
    }
    const site = await getSiteUrl().catch(() => process.env.NEXT_PUBLIC_SITE_URL ?? "");
    const msg = welcomeMessage({ name: c.name, slug: c.slug, sponsorName: c.sponsor?.name ?? null }, site);
    // Modèle dédié (WHATSAPP_TEMPLATE_WELCOME) si configuré ; sinon le modèle générique de WHATSAPP_TEMPLATE_NAME.
    const template = process.env.WHATSAPP_TEMPLATE_WELCOME || undefined;
    const res = await sendWhatsApp({
      to: c.whatsapp,
      kind: "reseller",
      text: msg.text,
      cta: msg.cta,
      ...(template ? { template, templateVars: welcomeTemplateVars({ name: c.name, slug: c.slug, sponsorName: c.sponsor?.name ?? null }, site) } : {}),
    });
    // Échec d'envoi : on libère l'envoi pour qu'un nouvel essai (ou un renvoi) reste possible.
    if (res.status === "ECHEC") await prisma.automationSent.delete({ where: { key: `bienvenue:${consultantId}` } }).catch(() => null);
  } catch (e) {
    console.error("[whatsapp] bienvenue", consultantId, e);
  }
}

/** Envoi après la réponse (la création du revendeur n'est jamais ralentie). */
export function notifyResellerWelcome(consultantId: string) {
  try {
    after(() => sendResellerWelcome(consultantId));
  } catch {
    void sendResellerWelcome(consultantId);
  }
}
