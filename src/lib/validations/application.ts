import { z } from "zod";

const text = (max: number) => z.string().trim().max(max);

export const applicationSchema = z.object({
  name: text(100).min(2, "Indiquez votre nom complet."),
  email: z.string().trim().toLowerCase().email("E-mail invalide.").max(254),
  phone: text(30).regex(/^[+\d][\d\s().-]{6,28}$/, "Numéro WhatsApp invalide."),
  city: text(80).min(2, "Indiquez votre ville."),
  country: text(60).default("Sénégal"),
  experience: text(500).optional().default(""),
  motivation: text(1000).optional().default(""),
  sponsorCode: text(48).optional().default(""),
  acceptTerms: z.literal(true, { error: "Vous devez accepter d'être recontacté·e." }),
});
