/**
 * Interrupteurs des automatisations (table Setting) : assistant de commande WhatsApp, relances,
 * demandes d'avis, résumé du soir, veille des prix Chogan. Tout est activé par défaut.
 */
import { prisma } from "./prisma";

export const AUTOMATIONS = {
  whatsappBot: { key: "auto_whatsapp_bot", label: "Assistant de commande sur WhatsApp", help: "Répond aux clients qui écrivent au numéro WhatsApp JAMAAL et prend leurs commandes." },
  relance45: { key: "auto_relance_45j", label: "Rappel « bientôt fini ? » 45 jours après un achat", help: "Message au client avec le lien du produit chez son revendeur." },
  birthday: { key: "auto_anniversaire", label: "Message d'anniversaire avec code cadeau", help: "Code de 10 % valable 15 jours (clients dont l'anniversaire est renseigné)." },
  cart: { key: "auto_panier", label: "Relance des paniers abandonnés", help: "Un rappel, quelques heures après un panier commencé sans commande." },
  reviews: { key: "auto_avis", label: "Demande d'avis après livraison", help: "Lien pour noter le produit et ajouter une photo, 2 jours après la livraison." },
  summary: { key: "auto_resume_soir", label: "Résumé du soir sur WhatsApp (équipe)", help: "Ventes, encaissements, ruptures, livraisons, revendeurs inactifs." },
  choganWatch: { key: "auto_veille_chogan", label: "Veille des prix Chogan", help: "Vérifie chaque jour une partie du catalogue et signale les changements de prix." },
} as const;

export type AutomationId = keyof typeof AUTOMATIONS;

export async function automationEnabled(id: AutomationId): Promise<boolean> {
  const row = await prisma.setting.findUnique({ where: { key: AUTOMATIONS[id].key } }).catch(() => null);
  return row ? row.value !== "0" : true;
}

export async function automationStates(): Promise<Record<AutomationId, boolean>> {
  const rows = await prisma.setting.findMany({ where: { key: { in: Object.values(AUTOMATIONS).map((a) => a.key) } } });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return Object.fromEntries(Object.entries(AUTOMATIONS).map(([id, a]) => [id, map.get(a.key) !== "0"])) as Record<AutomationId, boolean>;
}

export async function setAutomation(id: AutomationId, on: boolean) {
  const key = AUTOMATIONS[id].key;
  await prisma.setting.upsert({ where: { key }, create: { key, value: on ? "1" : "0" }, update: { value: on ? "1" : "0" } });
}

/** Marque un envoi automatique comme fait ; renvoie false s'il l'était déjà (aucun doublon). */
export async function claimAutomation(key: string): Promise<boolean> {
  try {
    await prisma.automationSent.create({ data: { key } });
    return true;
  } catch {
    return false;
  }
}
