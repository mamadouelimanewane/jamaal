/**
 * Numéro officiel WhatsApp Business de JAMAAL Luxury branché sur KwingoChat (format international, sans « + »).
 * Tous les messages provenant du site (bouton vert flottant, Commander sur WhatsApp, page Contact,
 * candidatures, diagnostics…) sont dirigés vers ce numéro unique sur KwingoChat.
 */
export const WHATSAPP_CONTACTS = [
  { number: "221711800909", display: "JAMAAL Luxury", phone: "+221 71 180 09 09" },
] as const;

export const WHATSAPP_GREETING = "Bonjour JAMAAL Luxury, je souhaite des informations.";

export const whatsappLink = (number: string, text: string = WHATSAPP_GREETING) =>
  `https://wa.me/${number}?text=${encodeURIComponent(text)}`;

export type SiteWhatsApp = { number: string; display: string; phone: string };

/** « 2207701234 » → « +220 770 12 34 » (affichage d'un numéro gambien). */
export function displayIntlPhone(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (/^220\d{7}$/.test(d)) return `+220 ${d.slice(3, 6)} ${d.slice(6, 8)} ${d.slice(8)}`;
  return `+${d}`;
}
