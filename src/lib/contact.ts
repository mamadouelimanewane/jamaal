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
