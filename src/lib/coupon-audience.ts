/**
 * Codes promo ciblés (Admin › Codes promo) : générés par le système, pour tous les clients, un client,
 * un vendeur ou tous les vendeurs ; partagés par lien ou WhatsApp. Pur, testé.
 */

export const AUDIENCES = [
  { id: "TOUS_CLIENTS", label: "Tous les clients", help: "Utilisable par tout client sur le site." },
  { id: "CLIENT", label: "Un client", help: "Réservé au client choisi (son numéro de téléphone)." },
  { id: "VENDEUR", label: "Un vendeur", help: "Pour les ventes d'un conseiller : sa boutique, son lien ou ses commandes." },
  { id: "TOUS_VENDEURS", label: "Tous les vendeurs", help: "Pour les ventes de n'importe quel conseiller." },
] as const;
export type Audience = (typeof AUDIENCES)[number]["id"];
export const isAudience = (v: unknown): v is Audience => AUDIENCES.some((a) => a.id === v);
export const audienceLabel = (v: string) => AUDIENCES.find((a) => a.id === v)?.label ?? "Tous les clients";

/** Lettres et chiffres sans confusion possible (pas de 0/O, 1/I/L). */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const PREFIX: Record<Audience, string> = { TOUS_CLIENTS: "JAM", CLIENT: "CLI", VENDEUR: "VEN", TOUS_VENDEURS: "PRO" };

/** Code généré : préfixe selon la cible + 6 caractères (ex. CLI-7KQ2MX). */
const secureIndex = (n: number) => globalThis.crypto.getRandomValues(new Uint32Array(1))[0] % n;

export function generateCode(audience: Audience, pick: (n: number) => number = secureIndex): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += ALPHABET[pick(ALPHABET.length)];
  return `${PREFIX[audience]}-${s}`;
}

export const phoneTail = (p: string | null | undefined) => {
  const d = (p ?? "").replace(/\D/g, "");
  return d.length >= 9 ? d.slice(-9) : "";
};

export type CouponTarget = { audience: string; targetPhone: string | null; targetConsultantId: string | null };
/** Contexte connu de la commande : undefined = pas encore connu (aperçu du panier), null = absent. */
export type CouponCtx = { phone?: string | null; consultantId?: string | null };

/** Raison du refus d'un code pour cette commande, ou null s'il s'applique. */
export function audienceRefusal(c: CouponTarget, ctx: CouponCtx = {}): string | null {
  if (c.audience === "CLIENT") {
    if (ctx.phone === undefined) return null;
    return phoneTail(ctx.phone) && phoneTail(ctx.phone) === phoneTail(c.targetPhone) ? null : "Ce code est personnel : il est réservé à un autre client.";
  }
  if (c.audience === "VENDEUR") {
    // Sans conseiller choisi, la vente est attribuée au vendeur du code ; avec un autre conseiller, refusé.
    if (!ctx.consultantId) return null;
    return ctx.consultantId === c.targetConsultantId ? null : "Ce code est réservé aux ventes d'un autre conseiller JAMAAL.";
  }
  if (c.audience === "TOUS_VENDEURS") {
    if (ctx.consultantId === undefined) return null;
    return ctx.consultantId ? null : "Ce code s'utilise avec un conseiller JAMAAL : choisissez votre conseiller ou utilisez son lien.";
  }
  return null;
}

/** Lien qui ouvre le panier avec le code (et le conseiller, pour un code vendeur). */
export function couponLink(origin: string, code: string, slug?: string | null): string {
  const q = new URLSearchParams({ code });
  if (slug) q.set("ref", slug);
  return `${origin.replace(/\/$/, "")}/panier?${q.toString()}`;
}

const F = (n: number) => `${n.toLocaleString("fr-FR").replace(/ | /g, " ")} F CFA`;

/** Message WhatsApp prêt à envoyer. */
export function couponMessage(o: { audience: string; name?: string | null; code: string; kind: "POURCENTAGE" | "MONTANT_FIXE"; value: number; expiresAt?: Date | null; link: string }): string {
  const first = (o.name ?? "").trim().split(/\s+/)[0];
  const advantage = o.kind === "POURCENTAGE" ? `-${o.value} %` : `-${F(o.value)}`;
  const until = o.expiresAt ? `, valable jusqu'au ${o.expiresAt.toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" })}` : "";
  const hello = `Bonjour${first ? ` ${first}` : ""} 🌸`;
  if (o.audience === "VENDEUR" || o.audience === "TOUS_VENDEURS") {
    return `${hello}\nNouveau code promo JAMAAL pour vos clients : *${o.code}* (${advantage}${until}).\nPartagez ce lien, le code s'applique tout seul : ${o.link}\nVous pouvez aussi le saisir dans « Nouvelle commande ».`;
  }
  return `${hello}\n${o.audience === "CLIENT" ? "Un code promo rien que pour vous" : "Un code promo JAMAAL"} : *${o.code}* (${advantage}${until}).\nIl s'applique tout seul avec ce lien : ${o.link}`;
}
