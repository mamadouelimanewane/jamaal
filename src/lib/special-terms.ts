/**
 * Conditions spéciales d'un revendeur (pur, testé) : encaissement direct du client, taux de commission propres,
 * zones de livraison propres. Un ensemble de conditions s'applique à un ou plusieurs revendeurs.
 */

export const COLLECT_METHODS = ["ESPECES", "WAVE", "ORANGE_MONEY"] as const;
export type CollectMethod = (typeof COLLECT_METHODS)[number];
export const COLLECT_LABELS: Record<CollectMethod, string> = { ESPECES: "Espèces", WAVE: "Wave", ORANGE_MONEY: "Orange Money" };
export const isCollectMethod = (v: unknown): v is CollectMethod => typeof v === "string" && (COLLECT_METHODS as readonly string[]).includes(v);

/** Référence de paiement d'une vente encaissée par le revendeur. */
export const COLLECT_REF_PREFIX = "encaisse:";
export const collectRef = (m: CollectMethod) => `${COLLECT_REF_PREFIX}${m}`;
/** « Espèces (encaissé par le revendeur) » si la vente a été encaissée par le revendeur, sinon null. */
export function collectedLabel(paymentRef: string | null | undefined): string | null {
  if (!paymentRef?.startsWith(COLLECT_REF_PREFIX)) return null;
  const m = paymentRef.slice(COLLECT_REF_PREFIX.length);
  return `${isCollectMethod(m) ? COLLECT_LABELS[m] : m} (encaissé par le revendeur)`;
}

export type SpecialZone = { name: string; fee: number };
export type TermsLike = {
  active: boolean;
  collectMethods: string[];
  creditLimit: number;
  sellerPct: number | null;
  level1Pct: number | null;
  level2Pct: number | null;
  zones: unknown;
};

/** Zones valides (nom non vide, frais ≥ 0 entiers), sans doublon de nom, 30 au plus. */
export function parseZones(raw: unknown): SpecialZone[] {
  let v = raw;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(v)) return [];
  const out: SpecialZone[] = [];
  for (const z of v) {
    const name = String((z as SpecialZone)?.name ?? "").trim().slice(0, 80);
    const fee = Math.round(Number((z as SpecialZone)?.fee));
    if (!name || !Number.isFinite(fee) || fee < 0 || fee > 1_000_000) continue;
    if (out.some((o) => o.name.toLowerCase() === name.toLowerCase())) continue;
    out.push({ name, fee });
    if (out.length >= 30) break;
  }
  return out;
}

/** Zones saisies une par ligne : « Nom ; frais » (ou « Nom : frais », « Nom - frais »). */
export function zonesFromText(text: string): { zones: SpecialZone[]; errors: string[] } {
  const zones: SpecialZone[] = [];
  const errors: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const l = line.trim();
    if (!l) continue;
    const m = l.match(/^(.+?)\s*[;:=|]\s*([\d\s.]+)\s*(?:f|fcfa)?$/i) ?? l.match(/^(.+?)\s+-\s+([\d\s.]+)\s*(?:f|fcfa)?$/i);
    if (!m) {
      errors.push(`« ${l.slice(0, 40)} » : écrivez « Nom de la zone ; frais »`);
      continue;
    }
    zones.push({ name: m[1].trim(), fee: Number(m[2].replace(/[\s.]/g, "")) });
  }
  return { zones: parseZones(zones), errors };
}
export const zonesToText = (zones: SpecialZone[]) => zones.map((z) => `${z.name} ; ${z.fee}`).join("\n");

/** Les conditions actives qui s'appliquent (null si aucune ou désactivées). */
export function activeTerms<T extends TermsLike>(t: T | null | undefined): T | null {
  return t && t.active ? t : null;
}

/** Taux du modèle économique, remplacés par les taux propres des conditions spéciales du vendeur. */
export function withSpecialRates<R extends { seller: number; level1: number; level2: number }>(rates: R, terms: TermsLike | null | undefined): R & { special: boolean } {
  const t = activeTerms(terms);
  if (!t) return { ...rates, special: false };
  const special = t.sellerPct != null || t.level1Pct != null || t.level2Pct != null;
  return { ...rates, seller: t.sellerPct ?? rates.seller, level1: t.level1Pct ?? rates.level1, level2: t.level2Pct ?? rates.level2, special };
}

/** Moyens d'encaissement direct autorisés. */
export function allowedCollect(terms: TermsLike | null | undefined): CollectMethod[] {
  const t = activeTerms(terms);
  return t ? COLLECT_METHODS.filter((m) => t.collectMethods.includes(m)) : [];
}

/**
 * Encaissement direct : le montant passe au débit du wallet du revendeur. Refusé si l'argent à reverser
 * dépasserait le plafond. Renvoie null si c'est permis, sinon le message d'erreur.
 */
export function collectRefusal(balance: number, amount: number, creditLimit: number): string | null {
  const after = balance - amount;
  if (after >= -Math.max(0, creditLimit)) return null;
  const owed = Math.max(0, -balance);
  const fmt = (n: number) => `${n.toLocaleString("fr-FR")} F`;
  return creditLimit <= 0
    ? `Encaissement direct impossible : votre plafond d'argent à reverser est de 0 F (solde du wallet ${fmt(balance)}). Contactez JAMAAL.`
    : `Plafond atteint : vous avez déjà ${fmt(owed)} encaissés à reverser à JAMAAL (plafond ${fmt(creditLimit)}). Reversez l'argent avant d'encaisser cette vente de ${fmt(amount)}.`;
}

/** Lecture d'un pourcentage saisi : vide = taux normal (null), sinon 0 à 60 %. */
export function parsePct(raw: unknown): number | null | "invalid" {
  const s = String(raw ?? "").trim().replace(",", ".").replace("%", "");
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0 || n > 60) return "invalid";
  return Math.round(n * 100) / 100;
}

const METHOD_LABELS: Record<string, string> = { A_LA_LIVRAISON: "À la livraison", WAVE: "Wave", ORANGE_MONEY: "Orange Money", STRIPE: "Carte bancaire", WALLET: "Wallet du revendeur" };
/** Ligne « Paiement » d'une fiche commande. */
export function paymentLine(o: { paymentMethod: string; paymentStatus: string; paymentRef?: string | null }): string {
  const how = collectedLabel(o.paymentRef) ?? METHOD_LABELS[o.paymentMethod] ?? o.paymentMethod;
  return `${how} · ${o.paymentStatus === "PAYE" ? "payé" : o.paymentStatus === "ECHOUE" ? "échec" : "en attente"}`;
}
