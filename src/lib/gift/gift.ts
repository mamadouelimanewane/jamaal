/**
 * Cartes cadeaux et « Offrir à distance » : règles pures (testées), sans accès à la base.
 */
export const GIFT_PREFIX = "gift_";
export const GIFT_MIN = 5_000;
export const GIFT_MAX = 500_000;
export const GIFT_AMOUNTS = [10_000, 20_000, 30_000, 50_000, 100_000];
/** Validité d'une carte cadeau (jours). */
export const GIFT_VALIDITY_DAYS = 365;

export const OCCASIONS = [
  { id: "tabaski", label: "Tabaski", phrase: "pour la Tabaski" },
  { id: "korite", label: "Korité", phrase: "pour la Korité" },
  { id: "anniversaire", label: "Anniversaire", phrase: "pour votre anniversaire" },
  { id: "mariage", label: "Mariage", phrase: "pour votre mariage" },
  { id: "bapteme", label: "Baptême", phrase: "pour le baptême" },
  { id: "fete-meres", label: "Fête des mères", phrase: "pour la fête des mères" },
  { id: "saint-valentin", label: "Saint-Valentin", phrase: "pour la Saint-Valentin" },
  { id: "noel", label: "Noël / fin d'année", phrase: "pour les fêtes" },
  { id: "merci", label: "Pour dire merci", phrase: "pour vous dire merci" },
  { id: "autre", label: "Juste comme ça", phrase: "" },
] as const;
export type OccasionId = (typeof OCCASIONS)[number]["id"];

export const occasionOf = (id: unknown) => OCCASIONS.find((o) => o.id === id) ?? null;
/** « pour la Tabaski » précédé d'un espace, ou rien. */
export const occasionPhrase = (id: unknown) => {
  const o = occasionOf(id);
  return o?.phrase ? ` ${o.phrase}` : "";
};

export function validGiftAmount(raw: unknown): number | null {
  const n = Math.round(Number(String(raw ?? "").replace(/[\s.]/g, "")));
  if (!Number.isFinite(n) || n < GIFT_MIN || n > GIFT_MAX) return null;
  return Math.round(n / 500) * 500;
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans 0/O ni 1/I
/** Code lisible au téléphone : JML-XXXX-XXXX. */
export function newGiftCode(rand: (n: number) => number = (n) => Math.floor(Math.random() * n)): string {
  const part = () => Array.from({ length: 4 }, () => ALPHABET[rand(ALPHABET.length)]).join("");
  return `JML-${part()}-${part()}`;
}
export const looksLikeGiftCode = (raw: string) => /^JML-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(raw.trim().toUpperCase());

/** Montant de la carte utilisé sur une commande (produits + livraison). */
export const giftRedemption = (balance: number, due: number) => Math.max(0, Math.min(balance, due));

export function cleanPhone(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  const digits = s.replace(/\D/g, "").replace(/^00/, "");
  if (digits.length < 9 || digits.length > 15 || !/^[+\d\s().-]+$/.test(s)) return null;
  return digits;
}

/** Message vocal enregistré par JAMAAL (stockage du site, dossier cadeaux) : seule adresse acceptée. */
export const isOwnVoiceUrl = (u: string) => /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/cadeaux\/[\w.-]+$/i.test(u);

/** Informations « Offrir à distance » venues du navigateur, nettoyées. */
export function cleanGiftInfo(raw: unknown): { occasion: string | null; from: string | null; voiceUrl: string | null } | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const voice = typeof r.voiceUrl === "string" && isOwnVoiceUrl(r.voiceUrl) ? r.voiceUrl : null;
  const from = typeof r.from === "string" ? r.from.trim().slice(0, 80) || null : null;
  const occasion = occasionOf(r.occasion)?.id ?? null;
  return occasion || from || voice ? { occasion, from, voiceUrl: voice } : undefined;
}
