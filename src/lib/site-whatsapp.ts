import { cache } from "react";
import { prisma } from "./prisma";
import { WHATSAPP_CONTACTS, displayIntlPhone, type SiteWhatsApp } from "./contact";

/** Numéro WhatsApp affiché sur la version anglaise (Gambie), réglé dans Admin › Réglages ; vide = numéro JAMAAL habituel. */
const KEY = "contact_whatsapp_gm";

export const getGambiaWhatsApp = cache(async (): Promise<string | null> => {
  try {
    const row = await prisma.setting.findUnique({ where: { key: KEY } });
    const d = (row?.value ?? "").replace(/\D/g, "");
    return /^220\d{7}$/.test(d) ? d : null;
  } catch {
    return null;
  }
});

export async function setGambiaWhatsApp(raw: string) {
  const d = raw.replace(/\D/g, "").replace(/^00/, "");
  const value = d === "" ? "" : /^\d{7}$/.test(d) ? `220${d}` : d;
  if (value && !/^220\d{7}$/.test(value)) throw new Error("Numéro gambien invalide : +220 suivi de 7 chiffres (ex. +220 770 12 34).");
  await prisma.setting.upsert({ where: { key: KEY }, update: { value }, create: { key: KEY, value } });
}

/** Numéro WhatsApp du site dans une langue : gambien pour l'anglais s'il est réglé, sinon le numéro JAMAAL. */
export async function siteWhatsAppFor(locale: string): Promise<SiteWhatsApp> {
  const gm = locale === "en" ? await getGambiaWhatsApp() : null;
  return gm ? { number: gm, display: "JAMAAL Gambia", phone: displayIntlPhone(gm) } : { ...WHATSAPP_CONTACTS[0] };
}
