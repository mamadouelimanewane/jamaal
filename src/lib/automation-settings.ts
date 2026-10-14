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
  orderTracking: { key: "auto_suivi_commande", label: "Suivi de commande sur WhatsApp (clients)", help: "Commande reçue avec bouton « Payer », paiement reçu, confirmée, expédiée, annulée, remise." },
  staffWhatsApp: { key: "auto_whatsapp_equipe", label: "Assistant WhatsApp des revendeurs, de l'équipe et des livreurs", help: "Un revendeur, un admin ou un livreur qui écrit au numéro JAMAAL est reconnu et servi par son assistant." },
  alerts: { key: "auto_alertes_whatsapp", label: "Alertes WhatsApp (revendeurs et équipe)", help: "Commission créditée, retrait versé, nouveau filleul, défi presque atteint ; avis négatif, retour, paiement échoué." },
  welcome: { key: "auto_bienvenue_revendeur", label: "Message de bienvenue aux nouveaux revendeurs", help: "Un seul message WhatsApp à chaque nouveau revendeur : bienvenue, lien de vente personnel, premiers pas." },
  morningKit: { key: "auto_kit_matin", label: "Kit du matin des revendeurs (8 h)", help: "Visuel du jour, texte prêt à publier et lien personnel, chaque matin sur WhatsApp." },
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
