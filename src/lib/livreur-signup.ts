/**
 * Inscription d'un livreur depuis l'application JAMAAL Livreur (pur, testé) : lecture et contrôle du
 * formulaire. L'écriture en base et les notifications sont dans actions/livreur-signup.ts.
 */
import { canonicalizePhone } from "@/lib/phone";

export const LIVREUR_PENDING = "EN_ATTENTE";
export const LIVREUR_ACTIVE = "ACTIF";
export const LIVREUR_REFUSED = "REFUSE";

export const VEHICLES = [
  { id: "MOTO", label: "Moto" },
  { id: "SCOOTER", label: "Scooter" },
  { id: "VELO", label: "Vélo" },
  { id: "VOITURE", label: "Voiture" },
  { id: "PIED", label: "À pied" },
] as const;
export type VehicleId = (typeof VEHICLES)[number]["id"];

export const vehicleLabel = (id: string | null | undefined) => VEHICLES.find((v) => v.id === id)?.label ?? "";

export const ID_TYPES = [
  { id: "CNI", label: "Carte d'identité (CNI / CEDEAO)", verso: true },
  { id: "PASSEPORT", label: "Passeport", verso: false },
  { id: "PERMIS", label: "Permis de conduire", verso: true },
] as const;
export type IdType = (typeof ID_TYPES)[number]["id"];
export const idTypeLabel = (id: string | null | undefined) => ID_TYPES.find((t) => t.id === id)?.label ?? "Pièce d'identité";
export const needsVerso = (id: string) => ID_TYPES.find((t) => t.id === id)?.verso ?? false;

/** Fichier de pièce d'identité : photo (JPEG, PNG, WebP, HEIC) ou PDF, 3 Mo au plus. */
export const DOC_MAX_BYTES = 3 * 1024 * 1024;
export const DOC_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"];
export function docFileError(f: { type: string; size: number } | null | undefined, what: string): string | null {
  if (!f || !f.size) return `Ajoutez la photo ${what} de votre pièce d'identité.`;
  if (!DOC_TYPES.includes(f.type)) return `Photo ${what} : format non accepté (photo JPEG, PNG ou PDF).`;
  if (f.size > DOC_MAX_BYTES) return `Photo ${what} trop lourde (3 Mo au plus).`;
  return null;
}

/** Vrai format du fichier d'après son contenu (le type annoncé par le téléphone ne suffit pas). */
export function sniffDocType(b: Uint8Array): string | null {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return "application/pdf";
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (ascii(4, 8) === "ftyp" && /^(heic|heix|hevc|mif1|msf1|heim|heis)$/.test(ascii(8, 12))) return "image/heic";
  return null;
}

export const PAYOUT_PROVIDERS = [
  { id: "WAVE", label: "Wave" },
  { id: "ORANGE_MONEY", label: "Orange Money" },
] as const;

export type LivreurSignup = {
  name: string;
  phone: string;
  password: string;
  zone: string;
  vehicle: VehicleId;
  idType: IdType;
  idNumber: string;
  walletProvider: string | null;
  walletNumber: string | null;
};

export type SignupCheck = { ok: true; data: LivreurSignup } | { ok: false; error: string; field?: string };

const str = (f: FormData, k: string, max = 120) => String(f.get(k) ?? "").trim().slice(0, max);
const isMobile = (canonical: string) => /^221(7[05678])\d{7}$/.test(canonical) || (!canonical.startsWith("221") && canonical.length >= 9 && canonical.length <= 15);

/** Contrôle du formulaire d'inscription ; messages en clair, champ en défaut indiqué. */
export function parseLivreurSignup(f: FormData): SignupCheck {
  const name = str(f, "name", 80).replace(/\s+/g, " ");
  const phoneRaw = str(f, "phone", 30);
  const password = String(f.get("password") ?? "");
  const confirm = String(f.get("confirm") ?? "");
  const zone = str(f, "zone", 120);
  const vehicle = str(f, "vehicle", 20).toUpperCase();
  const idNumber = str(f, "idNumber", 40).toUpperCase();
  const idType = str(f, "idType", 20).toUpperCase();
  const walletProviderRaw = str(f, "walletProvider", 20).toUpperCase();
  const walletRaw = str(f, "walletNumber", 30);

  if (name.length < 3 || !/\s/.test(name)) return { ok: false, field: "name", error: "Indiquez votre prénom et votre nom." };
  const phone = phoneRaw.replace(/\D/g, "").length >= 9 ? canonicalizePhone(phoneRaw) : "";
  if (!phone || !isMobile(phone)) return { ok: false, field: "phone", error: "Numéro WhatsApp invalide : tapez par exemple 77 123 45 67." };
  if (password.length < 8 || !/\d/.test(password) || !/[a-z]/i.test(password)) return { ok: false, field: "password", error: "Mot de passe : au moins 8 caractères, avec des lettres et au moins un chiffre." };
  if (password !== confirm) return { ok: false, field: "confirm", error: "Les deux mots de passe ne sont pas identiques." };
  if (zone.length < 2) return { ok: false, field: "zone", error: "Indiquez vos quartiers ou votre zone de livraison." };
  if (!VEHICLES.some((v) => v.id === vehicle)) return { ok: false, field: "vehicle", error: "Choisissez votre moyen de déplacement." };
  if (!ID_TYPES.some((t) => t.id === idType)) return { ok: false, field: "idType", error: "Choisissez votre pièce d'identité : carte d'identité, passeport ou permis de conduire." };
  if (idNumber.replace(/[^0-9A-Z]/g, "").length < 5) return { ok: false, field: "idNumber", error: "Indiquez le numéro de votre pièce d'identité." };
  const walletProvider = PAYOUT_PROVIDERS.some((p) => p.id === walletProviderRaw) ? walletProviderRaw : null;
  const walletNumber = walletRaw ? (walletRaw.replace(/\D/g, "").length >= 9 ? canonicalizePhone(walletRaw) : "") : walletProvider ? phone : null;
  if (walletNumber === "") return { ok: false, field: "walletNumber", error: "Numéro de paiement (Wave / Orange Money) invalide." };
  if (f.get("charte") !== "on") return { ok: false, field: "charte", error: "Acceptez la charte du livreur JAMAAL pour continuer." };

  return { ok: true, data: { name, phone, password, zone, vehicle: vehicle as VehicleId, idType: idType as IdType, idNumber, walletProvider, walletNumber: walletProvider ? walletNumber : null } };
}

/** Message WhatsApp de l'administrateur au livreur après la décision. */
export function livreurDecisionMessage(name: string, approved: boolean, appUrl: string): string {
  const first = name.split(/\s+/)[0] ?? name;
  return approved
    ? `Bonjour ${first}, votre inscription comme livreur JAMAAL est validée ✅. Ouvrez l'application JAMAAL Livreur et connectez-vous avec votre numéro WhatsApp et votre mot de passe : ${appUrl}`
    : `Bonjour ${first}, merci pour votre inscription comme livreur JAMAAL. Nous ne pouvons pas la retenir pour le moment. N'hésitez pas à nous écrire pour en savoir plus.`;
}

/** Lien wa.me (le message part depuis le téléphone de l'administrateur). */
export function waLink(phone: string, text: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}
