/** Chiffres d'un numéro au format international (sans +, sans 00 ni espaces). */
const intlDigits = (phone: string | null | undefined) => (phone ?? "").replace(/\D/g, "").replace(/^00/, "");

/**
 * Numéro mauritanien : indicatif +222 suivi de 8 chiffres (mobiles en 2, 3 ou 4).
 * Sert à proposer la boutique du revendeur en arabe, avec les prix en ouguiya.
 */
export function isMauritanianNumber(phone: string | null | undefined): boolean {
  return /^222[234]\d{7}$/.test(intlDigits(phone));
}

/**
 * Numéro saisi par un client : +222 explicite, ou 8 chiffres commençant par 2, 3 ou 4 (format local mauritanien ;
 * les numéros sénégalais en ont 9). Sert à lui proposer le site en arabe avec les prix en ouguiya.
 */
export function looksMauritanian(phone: string | null | undefined): boolean {
  return isMauritanianNumber(phone) || /^[234]\d{7}$/.test((phone ?? "").replace(/\D/g, ""));
}

/** Numéro gambien : indicatif +220 suivi de 7 chiffres. Sert à proposer le site et la boutique en anglais (prix en dalasi). */
export function isGambianNumber(phone: string | null | undefined): boolean {
  return /^220[2-9]\d{6}$/.test(intlDigits(phone));
}

/** Numéro saisi par un client : +220 explicite, ou 7 chiffres (format local gambien ; Sénégal 9, Mauritanie 8). */
export function looksGambian(phone: string | null | undefined): boolean {
  return isGambianNumber(phone) || /^[2-9]\d{6}$/.test((phone ?? "").replace(/\D/g, ""));
}

/** Langue à proposer au client d'après son numéro : arabe (Mauritanie), anglais (Gambie), ou rien. */
export function languageForPhone(phone: string | null | undefined): "ar" | "en" | null {
  return looksMauritanian(phone) ? "ar" : looksGambian(phone) ? "en" : null;
}

/** Langue de la boutique d'un revendeur d'après son numéro WhatsApp (indicatif explicite seulement). */
export function shopLanguageForNumber(whatsapp: string | null | undefined): "ar" | "en" | null {
  return isMauritanianNumber(whatsapp) ? "ar" : isGambianNumber(whatsapp) ? "en" : null;
}
