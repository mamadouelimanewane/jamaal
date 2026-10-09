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
  sponsorCode: text(48).min(2, "Le code de parrainage est obligatoire : demandez-le à la personne qui vous a présenté JAMAAL."),
  acceptTerms: z.literal(true, { error: "Vous devez accepter d'être recontacté·e." }),
  address: text(300).min(8, "Indiquez votre adresse complète (quartier, rue, ville)."),
  idType: z.enum(["CNI", "PASSEPORT", "CEDEAO"], { error: "Choisissez le type de pièce d'identité." }),
  idNumber: text(30).regex(/^[A-Za-z0-9 -]{5,30}$/, "Numéro de pièce d'identité invalide."),
  acceptProtocol: z.literal(true, { error: "Lisez le protocole de partenariat et cochez « Lu et approuvé »." }),
});
