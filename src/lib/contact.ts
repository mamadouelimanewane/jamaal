/** Numéros WhatsApp de la boutique (format international, sans « + »). */
export const WHATSAPP_CONTACTS = [
  { number: "221777529288", display: "+221 77 752 92 88" },
  { number: "221776700996", display: "+221 77 670 09 96" },
] as const;

export const WHATSAPP_GREETING = "Bonjour JAMAAL, je souhaite des informations.";

export const whatsappLink = (number: string, text: string = WHATSAPP_GREETING) =>
  `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
