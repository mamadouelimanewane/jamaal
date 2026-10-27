/**
 * Textes de partage d'un ou plusieurs produits (WhatsApp, statut, TikTok). Pur, testé.
 * Chaque lien porte le code du revendeur (?ref=) : la vente lui est attribuée.
 */
export type ShareItem = { slug: string; name: string; price?: number | null; choganCode?: string | null; inspiredBy?: string | null; multiFormat?: boolean };

/** Prix affiché : « à partir de 14 800 FCFA » quand le produit existe en plusieurs formats. Pur, testé. */
export const priceLabel = (price: number, multiFormat?: boolean) => `${multiFormat ? "à partir de " : ""}${price.toLocaleString("fr-FR")} FCFA`;

export const productLink = (origin: string, slug: string, refSlug: string | null) => `${origin}/produits/${slug}${refSlug ? `?ref=${refSlug}` : ""}`;

const fcfa = (n: number) => `${n.toLocaleString("fr-FR")} FCFA`;

export function shareMessage(items: ShareItem[], origin: string, refSlug: string | null, channel: "whatsapp" | "tiktok" | "instagram" | "facebook" = "whatsapp"): string {
  if (!items.length) return "";
  if (channel === "facebook") {
    // Facebook : liens cliquables dans la publication, idéal pour convertir avec le lien produit/boutique
    const shop = refSlug ? `${origin}/c/${refSlug}` : origin;
    if (items.length === 1) {
      const p = items[0];
      const link = productLink(origin, p.slug, refSlug);
      return `🌸 Découvrez ${p.name}${p.inspiredBy ? ` (inspiré de ${p.inspiredBy})` : ""}${p.price ? ` à seulement ${priceLabel(p.price, p.multiFormat)}` : ""} !\n\n✨ Haute parfumerie Chogan Italie, tenue longue durée.\n🚚 Livraison express partout à Dakar et au Sénégal.\n\n👉 Commandez directement ici : ${link}\nOu contactez-moi par message privé ou sur WhatsApp ! 🌸\n\n#JAMAAL #Chogan #ParfumDakar #Luxe #Dakar #Senegal`;
    }
    const lines = items.map((p) => `• ${p.name}${p.inspiredBy ? ` (inspiré de ${p.inspiredBy})` : ""}${p.price ? ` — ${priceLabel(p.price, p.multiFormat)}` : ""} : ${productLink(origin, p.slug, refSlug)}`);
    return `🌸 Ma sélection parfum & beauté JAMAAL Chogan 🌸\n\n${lines.join("\n")}\n\n🚚 Livraison rapide à domicile partout au Sénégal.\n👉 Visitez toute ma boutique : ${shop}\n\nContactez-moi en message privé ou sur WhatsApp pour commander ! ✨\n#JAMAAL #Chogan #ParfumDakar #Senegal`;
  }
  if (channel === "instagram") {
    // Instagram : liens non cliquables dans la légende → on renvoie au lien de la bio, avec la boutique en clair.
    const names = items.map((p) => `${p.name}${p.price ? ` — ${priceLabel(p.price, p.multiFormat)}` : ""}`).join("\n");
    const shop = refSlug ? `${origin}/c/${refSlug}` : origin;
    return `${names}\n✨ Parfums et soins Chogan au Sénégal.\n📩 Commande en message privé ou via le lien dans ma bio : ${shop.replace(/^https?:\/\//, "")}\n#JAMAAL #Chogan #parfum #skincare #Dakar #Senegal`;
  }
  if (channel === "tiktok") {
    const names = items.map((p) => p.name).join(" · ");
    const shop = refSlug ? `${origin}/c/${refSlug}` : productLink(origin, items[0].slug, refSlug);
    return `${names} ✨ Parfums et soins Chogan au Sénégal. Commande en message ou ici : ${shop}\n#JAMAAL #Chogan #parfum #Dakar #Senegal`;
  }
  if (items.length === 1) {
    const p = items[0];
    return `${p.name}${p.inspiredBy ? ` (inspiré de ${p.inspiredBy})` : ""}${p.price ? ` — ${priceLabel(p.price, p.multiFormat)}` : ""}. Commande ici : ${productLink(origin, p.slug, refSlug)}`;
  }
  const lines = items.map((p) => `• ${p.name}${p.price ? ` — ${priceLabel(p.price, p.multiFormat)}` : ""} : ${productLink(origin, p.slug, refSlug)}`);
  return `Ma sélection JAMAAL ✨\n${lines.join("\n")}\nRépondez-moi pour commander !`;
}

/** « Vous gagnez ≈ 2 340 F » : commission estimée sur une vente au prix donné. */
export function estimatedGainLabel(price: number | null, ratePct: number): string {
  const gain = price && ratePct > 0 ? Math.round((price * ratePct) / 100) : 0;
  return gain ? `Vous gagnez ≈ ${fcfa(gain).replace(" FCFA", " F")}` : "";
}
