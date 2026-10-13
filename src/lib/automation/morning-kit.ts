/**
 * Kit du matin (cron 8 h) : chaque revendeur actif reçoit sur WhatsApp le produit du jour —
 * son visuel personnalisé (QR code et WhatsApp du revendeur), un texte prêt à publier en statut,
 * et son lien de vente. Un seul texte est rédigé par jour (IA si disponible), puis personnalisé.
 * Idempotent : un envoi par revendeur et par jour. Désactivable par revendeur (kitMatin).
 */
import { prisma } from "@/lib/prisma";
import { automationEnabled, claimAutomation } from "@/lib/automation-settings";
import { generateContent, geminiConfigured, textOf } from "@/lib/ai/gemini";
import { sendWhatsApp, whatsappConfig } from "@/lib/whatsapp";

type Pick = { name: string; slug: string; price: number | null; inspiredBy: string | null; inspiredBrand: string | null; family: string | null };

/** Produit du jour : parmi les meilleures ventes en stock (avec photo), à tour de rôle selon la date. */
export async function productOfTheDay(now = new Date()): Promise<Pick | null> {
  const since = new Date(now.getTime() - 30 * 86_400_000);
  const top = await prisma.orderItem.groupBy({
    by: ["productId"],
    where: { productId: { not: null }, order: { createdAt: { gte: since }, status: { not: "ANNULEE" } } },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: 14,
  });
  let ids = top.map((t) => t.productId!).filter(Boolean);
  if (ids.length < 5) {
    const more = await prisma.product.findMany({ where: { stock: { gt: 0 }, photo: { not: null } }, orderBy: { createdAt: "desc" }, take: 14, select: { id: true } });
    ids = [...new Set([...ids, ...more.map((m) => m.id)])];
  }
  const products = await prisma.product.findMany({
    where: { id: { in: ids }, photo: { not: null }, stock: { gt: 0 } },
    select: { id: true, name: true, slug: true, regularPrice: true, volumes: true, inspiredBy: true, inspiredBrand: true, family: true },
    orderBy: { name: "asc" },
  });
  if (!products.length) return null;
  const day = Math.floor(now.getTime() / 86_400_000);
  const p = products[day % products.length];
  const vols = ((p.volumes as { price: number }[] | null) ?? []).filter((v) => v.price > 0);
  return { name: p.name, slug: p.slug, price: vols.length ? Math.min(...vols.map((v) => v.price)) : p.regularPrice, inspiredBy: p.inspiredBy, inspiredBrand: p.inspiredBrand, family: p.family };
}

/** Texte de statut du jour (pur pour la version sans IA, testé). */
export function fallbackStatusText(p: Pick): string {
  return [
    `✨ ${p.name}${p.inspiredBy ? `, inspiré de ${p.inspiredBy}${p.inspiredBrand ? ` (${p.inspiredBrand})` : ""}` : ""}`,
    p.family ? `Famille ${p.family.toLowerCase()} : un sillage qui ne passe pas inaperçu.` : "Un sillage qui ne passe pas inaperçu.",
    p.price ? `À partir de ${p.price.toLocaleString("fr-FR")} FCFA, extrait de parfum concentré.` : "Extrait de parfum concentré.",
    "Commandez ici 👇",
  ].join("\n");
}

async function statusText(p: Pick): Promise<string> {
  if (!geminiConfigured()) return fallbackStatusText(p);
  try {
    const reply = await generateContent({
      system: "Tu écris des statuts WhatsApp de vente pour des revendeurs de parfums au Sénégal. Ton chaleureux, 4 lignes maximum, 2 emojis au plus, pas de hashtag, pas de lien, prix en FCFA. Les parfums sont « inspirés de », jamais « le même ».",
      contents: [{ role: "user", parts: [{ text: `Statut du jour pour : ${p.name}${p.inspiredBy ? `, inspiré de ${p.inspiredBy} ${p.inspiredBrand ?? ""}` : ""}${p.family ? `, famille ${p.family}` : ""}${p.price ? `, à partir de ${p.price} FCFA` : ""}. Termine par un appel à commander.` }] }],
      maxOutputTokens: 400,
      thinking: "minimal",
      timeoutMs: 15_000,
    });
    const t = textOf(reply).replace(/https?:\/\/\S+/g, "").trim();
    return t.length > 20 ? t.slice(0, 600) : fallbackStatusText(p);
  } catch {
    return fallbackStatusText(p);
  }
}

export async function sendMorningKit(origin: string, now = new Date(), opts: { budgetMs?: number } = {}) {
  if (!(await automationEnabled("morningKit"))) return "désactivé";
  if (!whatsappConfig().active) return "WhatsApp non configuré";
  const p = await productOfTheDay(now);
  if (!p) return "aucun produit en stock";
  const text = await statusText(p);
  const started = Date.now();
  const day = now.toISOString().slice(0, 10);
  const resellers = await prisma.consultant.findMany({ where: { active: true, kitMatin: true }, select: { id: true, name: true, slug: true, whatsapp: true } });
  let sent = 0;
  for (const r of resellers) {
    if (Date.now() - started > (opts.budgetMs ?? 45_000)) break;
    if (!r.whatsapp || !r.slug) continue;
    if (!(await claimAutomation(`kit:${day}:${r.id}`))) continue;
    const link = `${origin}/produits/${p.slug}?ref=${r.slug}`;
    await sendWhatsApp({
      to: r.whatsapp,
      kind: "kit",
      imageUrl: `${origin}/api/visuel/${p.slug}?ref=${r.slug}&format=carre`,
      text: `☀️ Bonjour ${r.name.split(/\s+/)[0]} ! Produit du jour : *${p.name}*.\nEnregistrez l'image, publiez-la en statut avec ce texte :\n\n${text}\n${link}\n\n(Répondez « stop kit » pour ne plus recevoir le kit du matin.)`,
    });
    sent++;
  }
  return { produit: p.name, envoyes: sent };
}
