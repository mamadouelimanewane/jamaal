/**
 * Campagnes WhatsApp : un message (personnalisé avec {prenom}) envoyé à une audience filtrée
 * — clients (inactifs depuis N jours, acheteurs d'une catégorie, clients d'un revendeur) ou
 * revendeurs actifs. Les clients ayant répondu STOP sont exclus. Envoi par lots, reprenable :
 * un numéro déjà servi pour cette campagne n'est jamais relancé.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { phoneTail } from "@/lib/phone-match";
import { sendWhatsApp } from "./index";

export interface CampaignAudience {
  target: "CLIENTS" | "REVENDEURS";
  /** Clients sans commande depuis N jours (0 = tous). */
  inactiveDays?: number;
  /** Clients ayant acheté dans cette catégorie. */
  category?: string;
  /** Clients rattachés à ce revendeur. */
  consultantId?: string;
  /** Bouton lien facultatif. */
  cta?: { label: string; url: string } | null;
}

export function parseAudience(raw: unknown): CampaignAudience {
  const a = (raw ?? {}) as Record<string, unknown>;
  const s = (v: unknown, n = 80) => (typeof v === "string" ? v.trim().slice(0, n) : "");
  const cta = a.cta as { label?: unknown; url?: unknown } | null | undefined;
  const url = s(cta?.url, 300);
  return {
    target: a.target === "REVENDEURS" ? "REVENDEURS" : "CLIENTS",
    inactiveDays: Math.max(0, Math.min(3650, Math.round(Number(a.inactiveDays) || 0))),
    category: s(a.category) || undefined,
    consultantId: s(a.consultantId) || undefined,
    cta: url && /^https:\/\//.test(url) ? { label: s(cta?.label, 20) || "Voir", url } : null,
  };
}

/** Message personnalisé (pur, testé) : {prenom} et {nom}. */
export function personalize(body: string, name: string): string {
  const first = name.trim().split(/\s+/)[0] || "";
  return body.replace(/\{prenom\}/gi, first).replace(/\{nom\}/gi, name.trim()).replace(/[ \t]+([,.])/g, "$1").trim();
}

/** Destinataires (un par numéro, sur les 9 derniers chiffres). */
export async function campaignRecipients(a: CampaignAudience): Promise<{ phone: string; name: string }[]> {
  let rows: { phone: string; name: string }[];
  if (a.target === "REVENDEURS") {
    rows = (await prisma.consultant.findMany({ where: { active: true }, select: { whatsapp: true, name: true } })).map((c) => ({ phone: c.whatsapp, name: c.name }));
  } else {
    const conds: Prisma.Sql[] = [Prisma.sql`c."whatsappOptOut" = false`];
    if (a.inactiveDays) {
      const since = new Date(Date.now() - a.inactiveDays * 86_400_000);
      conds.push(Prisma.sql`EXISTS (SELECT 1 FROM "Order" o WHERE o."customerId" = c.id AND o.status <> 'ANNULEE')`);
      conds.push(Prisma.sql`NOT EXISTS (SELECT 1 FROM "Order" o WHERE o."customerId" = c.id AND o.status <> 'ANNULEE' AND o."createdAt" >= ${since})`);
    }
    if (a.category) conds.push(Prisma.sql`EXISTS (SELECT 1 FROM "Order" o JOIN "OrderItem" i ON i."orderId" = o.id JOIN "Product" p ON p.id = i."productId" WHERE o."customerId" = c.id AND o.status <> 'ANNULEE' AND p.category = ${a.category})`);
    if (a.consultantId) conds.push(Prisma.sql`EXISTS (SELECT 1 FROM "Order" o WHERE o."customerId" = c.id AND o."consultantId" = ${a.consultantId})`);
    rows = await prisma.$queryRaw<{ phone: string; name: string }[]>`SELECT c.phone, c.name FROM "Customer" c WHERE ${Prisma.join(conds, " AND ")} ORDER BY c."createdAt" ASC LIMIT 5000`;
  }
  const seen = new Set<string>();
  return rows.filter((r) => {
    const t = phoneTail(r.phone);
    if (!t || seen.has(t)) return false;
    seen.add(t);
    return true;
  });
}

/** Envoie (ou continue) une campagne pendant budgetMs ; renvoie l'état. */
export async function runCampaign(id: string, budgetMs = 45_000): Promise<{ sent: number; failed: number; total: number; done: boolean }> {
  const c = await prisma.whatsAppCampaign.findUnique({ where: { id } });
  if (!c) throw new Error("Campagne introuvable.");
  const audience = parseAudience(c.audience);
  const recipients = await campaignRecipients(audience);
  const already = new Set((await prisma.whatsAppMessage.findMany({ where: { campaignId: id }, select: { toNumber: true } })).map((m) => phoneTail(m.toNumber)));
  await prisma.whatsAppCampaign.update({ where: { id }, data: { status: "EN_COURS", total: recipients.length } });
  const started = Date.now();
  let done = true;
  for (const r of recipients) {
    if (already.has(phoneTail(r.phone))) continue;
    if (Date.now() - started > budgetMs) {
      done = false;
      break;
    }
    await sendWhatsApp({
      to: r.phone,
      kind: "campagne",
      campaignId: id,
      text: personalize(c.body, r.name),
      ...(process.env.WHATSAPP_TEMPLATE_MARKETING ? { template: process.env.WHATSAPP_TEMPLATE_MARKETING } : {}),
      ...(audience.cta ? { cta: audience.cta } : {}),
    });
  }
  const [sent, failed] = await Promise.all([
    prisma.whatsAppMessage.count({ where: { campaignId: id, status: { not: "ECHEC" } } }),
    prisma.whatsAppMessage.count({ where: { campaignId: id, status: "ECHEC" } }),
  ]);
  await prisma.whatsAppCampaign.update({ where: { id }, data: { sent, failed, status: done ? "ENVOYEE" : "EN_COURS", ...(done ? { sentAt: new Date() } : {}) } });
  return { sent, failed, total: recipients.length, done };
}
