/** Chiffres d'un numéro au format international (sans +, sans 00 ni espaces). */
const intlDigits = (phone: string | null | undefined) => (phone ?? "").replace(/\D/g, "").replace(/^00/, "");

/**
 * Numéro mauritanien : indicatif +222 suivi de 8 chiffres (mobiles en 2, 3 ou 4).
 * Sert à proposer la boutique du revendeur en arabe, avec les prix en ouguiya.
 */
export function isMauritanianNumber(phone: string | null | undefined): boolean {
  return /^222[234]\d{7}$/.test(intlDigits(phone));
}
