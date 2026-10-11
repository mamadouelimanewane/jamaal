import { normalizePhone } from "@/lib/phone";

/**
 * Un identifiant de connexion saisi par l'utilisateur peut être un e-mail ou un numéro de
 * téléphone (inscription par téléphone, sans e-mail). On distingue les deux par la présence
 * d'un « @ » ; le téléphone est normalisé (chiffres uniquement) pour correspondre à la valeur
 * stockée dans User.phone. Pur, sans dépendance à la base ou à Next.js.
 */
export type LoginIdentifier = { kind: "email"; value: string } | { kind: "phone"; value: string } | null;

export function parseLoginIdentifier(raw: string): LoginIdentifier {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.includes("@")) {
    const email = trimmed.toLowerCase();
    return email.length <= 254 ? { kind: "email", value: email } : null;
  }
  const phone = normalizePhone(trimmed);
  return phone.length >= 8 && phone.length <= 15 ? { kind: "phone", value: phone } : null;
}
