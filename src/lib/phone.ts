/**
 * Normalisation d'un numéro de téléphone : chiffres uniquement, sans le préfixe international
 * « 00 ». Sert d'identifiant stable (connexion, envoi WhatsApp) quel que soit le format saisi
 * (+221 77 000 00 00, 00221770000000, 77 000 00 00…). Pur, sans dépendance.
 */
export const normalizePhone = (raw: string) => raw.replace(/\D/g, "").replace(/^00/, "");

/**
 * Numéro local sénégalais : 9 chiffres commençant par 7 (mobile) ou 3 (fixe), sans l'indicatif.
 */
const isSnLocalNumber = (digits: string) => digits.length === 9 && /^[37]/.test(digits);

/**
 * Forme canonique d'un numéro sénégalais : toujours avec l'indicatif 221 (ex. "221771234567").
 * Un numéro local à 9 chiffres (« 77 123 45 67 ») et le même numéro avec indicatif
 * (« +221 77 123 45 67 ») doivent produire IDENTIQUEMENT la même valeur stockée, sinon un
 * compte créé avec l'un des deux formats refuse la connexion de quelqu'un qui tape l'autre
 * (symptôme observé : mot de passe « rejeté » alors qu'il est correct, surtout sur smartphone où
 * les contacts/l'autocomplétion suggèrent le numéro avec indicatif). Si la forme ne correspond à
 * aucun des deux cas reconnus (numéro étranger, format inhabituel), on renvoie la normalisation
 * simple sans rien supposer.
 */
export function canonicalizePhone(raw: string): string {
  const digits = normalizePhone(raw);
  if (isSnLocalNumber(digits)) return `221${digits}`;
  return digits;
}

/**
 * Toutes les formes sous lesquelles un numéro peut être stocké en base pour le même abonné
 * (avec et sans l'indicatif 221), à utiliser dans une recherche OR afin de rester tolérant aux
 * fiches déjà enregistrées dans l'ancien format (sans indicatif) comme aux nouvelles (avec).
 */
export function phoneLookupVariants(raw: string): string[] {
  const canonical = canonicalizePhone(raw);
  const local = canonical.length === 12 && canonical.startsWith("221") ? canonical.slice(3) : null;
  return local ? [canonical, local] : [canonical];
}
