/**
 * Textes de partage d'un ou plusieurs produits (WhatsApp, statut, TikTok). Pur, testé.
 * Chaque lien porte le code du revendeur (?ref=) : la vente lui est attribuée.
 */
export type ShareItem = { slug: string; name: string; price?: number | null; choganCode?: string | null; inspiredBy?: string | null };

export const productLink = (origin: string, slug: string, refSlug: string | null) => `${origin}/produits/${slug}${refSlug ? `?ref=${refSlug}` : ""}`;

const fcfa = (n: number) => `${n.toLocaleString("fr-FR")} FCFA`;

export function shareMessage(items: ShareItem[], origin: string, refSlug: string | null, channel: "whatsapp" | "tiktok" = "whatsapp"): string {
  if (!items.length) return "";
  if (channel === "tiktok") {
    const names = items.map((p) => p.name).join(" · ");
    const shop = refSlug ? `${origin}/c/${refSlug}` : productLink(origin, items[0].slug, refSlug);
    return `${names} ✨ Parfums et soins Chogan au Sénégal. Commande en message ou ici : ${shop}\n#JAMAAL #Chogan #parfum #Dakar #Senegal`;
  }
  if (items.length === 1) {
    const p = items[0];
    return `${p.name}${p.inspiredBy ? ` (inspiré de ${p.inspiredBy})` : ""}${p.price ? ` — ${fcfa(p.price)}` : ""}. Commande ici : ${productLink(origin, p.slug, refSlug)}`;
  }
  const lines = items.map((p) => `• ${p.name}${p.price ? ` — ${fcfa(p.price)}` : ""} : ${productLink(origin, p.slug, refSlug)}`);
  return `Ma sélection JAMAAL ✨\n${lines.join("\n")}\nRépondez-moi pour commander !`;
}

/** « Vous gagnez ≈ 2 340 F » : commission estimée sur une vente au prix donné. */
export function estimatedGainLabel(price: number | null, ratePct: number): string {
  const gain = price && ratePct > 0 ? Math.round((price * ratePct) / 100) : 0;
  return gain ? `Vous gagnez ≈ ${fcfa(gain).replace(" FCFA", " F")}` : "";
}
