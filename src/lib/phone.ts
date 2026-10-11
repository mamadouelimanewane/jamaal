/**
 * Normalisation d'un numéro de téléphone : chiffres uniquement, sans le préfixe international
 * « 00 ». Sert d'identifiant stable (connexion, envoi WhatsApp) quel que soit le format saisi
 * (+221 77 000 00 00, 00221770000000, 77 000 00 00…). Pur, sans dépendance.
 */
export const normalizePhone = (raw: string) => raw.replace(/\D/g, "").replace(/^00/, "");
