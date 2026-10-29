/**
 * Inscription d'un livreur depuis l'application JAMAAL Livreur (pur, testé) : lecture et contrôle du
 * formulaire. L'écriture en base et les notifications sont dans actions/livreur-signup.ts.
 */
import { canonicalizePhone } from "@/lib/phone";

export const LIVREUR_PENDING = "EN_ATTENTE";
export const LIVREUR_ACTIVE = "ACTIF";

export const VEHICLES = [
  { id: "MOTO", label: "Moto" },
  { id: "SCOOTER", label: "Scooter" },
  { id: "VELO", label: "Vélo" },
  { id: "VOITURE", label: "Voiture" },
  { id: "PIED", label: "À pied" },
] as const;
export type VehicleId = (typeof VEHICLES)[number]["id"];

export const vehicleLabel = (id: string | null | undefined) => VEHICLES.find((v) => v.id === id)?.label ?? "";

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
  idNumber: string | null;
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
  const idNumber = str(f, "idNumber", 40) || null;
  const walletProviderRaw = str(f, "walletProvider", 20).toUpperCase();
  const walletRaw = str(f, "walletNumber", 30);

  if (name.length < 3 || !/\s/.test(name)) return { ok: false, field: "name", error: "Indiquez votre prénom et votre nom." };
  const phone = phoneRaw.replace(/\D/g, "").length >= 9 ? canonicalizePhone(phoneRaw) : "";
  if (!phone || !isMobile(phone)) return { ok: false, field: "phone", error: "Numéro WhatsApp invalide : tapez par exemple 77 123 45 67." };
  if (password.length < 8 || !/\d/.test(password) || !/[a-z]/i.test(password)) return { ok: false, field: "password", error: "Mot de passe : au moins 8 caractères, avec des lettres et au moins un chiffre." };
  if (password !== confirm) return { ok: false, field: "confirm", error: "Les deux mots de passe ne sont pas identiques." };
  if (zone.length < 2) return { ok: false, field: "zone", error: "Indiquez vos quartiers ou votre zone de livraison." };
  if (!VEHICLES.some((v) => v.id === vehicle)) return { ok: false, field: "vehicle", error: "Choisissez votre moyen de déplacement." };
  const walletProvider = PAYOUT_PROVIDERS.some((p) => p.id === walletProviderRaw) ? walletProviderRaw : null;
  const walletNumber = walletRaw ? (walletRaw.replace(/\D/g, "").length >= 9 ? canonicalizePhone(walletRaw) : "") : walletProvider ? phone : null;
  if (walletNumber === "") return { ok: false, field: "walletNumber", error: "Numéro de paiement (Wave / Orange Money) invalide." };
  if (f.get("charte") !== "on") return { ok: false, field: "charte", error: "Acceptez la charte du livreur JAMAAL pour continuer." };

  return { ok: true, data: { name, phone, password, zone, vehicle: vehicle as VehicleId, idNumber, walletProvider, walletNumber: walletProvider ? walletNumber : null } };
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
