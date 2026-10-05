/**
 * Numéros WhatsApp de la boutique (format international, sans « + »).
 * `display` est le nom affiché au public (« Jamaal1 », « Jamaal2 ») : les numéros ne sont jamais
 * écrits en clair sur le site (ils ne figurent que dans les liens wa.me). `phone` n'est affiché
 * que dans l'administration.
 */
export const WHATSAPP_CONTACTS = [
  { number: "221777529288", display: "Jamaal1", phone: "+221 77 752 92 88" },
  { number: "221776700996", display: "Jamaal2", phone: "+221 77 670 09 96" },
] as const;

export const WHATSAPP_GREETING = "Bonjour JAMAAL, je souhaite des informations.";

export const whatsappLink = (number: string, text: string = WHATSAPP_GREETING) =>
  `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
