/**
 * Privilèges de l'équipe : un administrateur peut être « complet » (aucun profil) ou « restreint »
 * (un profil donne, par module, aucun accès / lecture / écriture). Module pur : utilisable partout.
 *
 * Règle de sécurité : tout ce qui n'est pas rattaché à un module est réservé à l'administrateur complet
 * (refus par défaut pour un profil restreint).
 */

export type Level = "read" | "write";

export const MODULE_IDS = [
  "catalogue",
  "commandes",
  "clients",
  "revendeurs",
  "livraison",
  "stocks",
  "comptabilite",
  "statistiques",
  "marketing",
  "whatsapp",
  "reglages",
  "utilisateurs",
] as const;
export type ModuleId = (typeof MODULE_IDS)[number];

export interface ModuleDef {
  id: ModuleId;
  label: string;
  description: string;
  /** Préfixes de pages d'administration couverts par le module. */
  paths: string[];
}

export const MODULES: ModuleDef[] = [
  { id: "catalogue", label: "Catalogue", description: "Produits, catégories, listino Chogan, import de produits.", paths: ["/admin/produits", "/admin/categories"] },
  { id: "commandes", label: "Commandes et réservations", description: "Commandes, factures, réservations, retours et remboursements.", paths: ["/admin/commandes", "/admin/reservations", "/admin/retours"] },
  { id: "clients", label: "Clients", description: "Fiches clients, messages reçus, avis.", paths: ["/admin/clients", "/admin/messages", "/admin/avis"] },
  { id: "revendeurs", label: "Revendeurs et réseau", description: "Consultants, candidatures, protocoles, primes d'équipe, défis.", paths: ["/admin/consultants", "/admin/candidatures", "/admin/protocole", "/admin/primes-equipe", "/admin/defis"] },
  { id: "livraison", label: "Livraison", description: "Livreurs, tournées, livraisons.", paths: ["/admin/livreurs", "/admin/livraisons"] },
  { id: "stocks", label: "Stocks", description: "Stocks par format, mouvements, réception, commande Chogan.", paths: ["/admin/stocks"] },
  { id: "comptabilite", label: "Comptabilité et finances", description: "Comptabilité, wallets, versements, dépenses.", paths: ["/admin/comptabilite", "/admin/wallets", "/admin/versements"] },
  { id: "statistiques", label: "Statistiques", description: "Tableaux de bord et statistiques de ventes.", paths: ["/admin/statistiques"] },
  { id: "marketing", label: "Marketing et contenu", description: "Page d'accueil, blog, annonces, offres, codes promo.", paths: ["/admin/accueil", "/admin/blog", "/admin/annonces", "/admin/offres", "/admin/coupons", "/admin/skin-advisor"] },
  { id: "whatsapp", label: "WhatsApp et automatisations", description: "Conversations, campagnes, journal, automatisations.", paths: ["/admin/whatsapp", "/admin/journal-whatsapp", "/admin/automatisations"] },
  { id: "reglages", label: "Réglages et modèle économique", description: "Réglages généraux, commissions, paiements, livraison.", paths: ["/admin/reglages", "/admin/modele-economique"] },
  { id: "utilisateurs", label: "Utilisateurs et journal", description: "Comptes, rôles, privilèges, journal d'activité.", paths: ["/admin/utilisateurs", "/admin/historique"] },
];

export const MODULE_LABEL: Record<ModuleId, string> = Object.fromEntries(MODULES.map((m) => [m.id, m.label])) as Record<ModuleId, string>;

/** Privilèges par module. Absent = aucun accès ; « write » donne aussi la lecture. */
export type Permissions = Partial<Record<ModuleId, Level>>;

export const isModuleId = (v: unknown): v is ModuleId => typeof v === "string" && (MODULE_IDS as readonly string[]).includes(v);

/** Module d'une page d'administration (préfixe le plus long), ou null si elle n'en a pas. */
export function moduleForPath(pathname: string): ModuleId | null {
  let best: { id: ModuleId; len: number } | null = null;
  for (const m of MODULES) {
    for (const p of m.paths) {
      if ((pathname === p || pathname.startsWith(p + "/")) && (!best || p.length > best.len)) best = { id: m.id, len: p.length };
    }
  }
  return best?.id ?? null;
}

/**
 * Le profil autorise-t-il cette opération ? `perms` null = administrateur complet (tout est permis).
 * Pour un profil restreint : le module doit être connu ET accordé au niveau demandé.
 */
export function allows(perms: Permissions | null, module: ModuleId | null | undefined, level: Level): boolean {
  if (perms === null) return true;
  if (!module) return false;
  const granted = perms[module];
  if (!granted) return false;
  return level === "read" ? true : granted === "write";
}

/** Nettoie un objet de privilèges venu d'un formulaire ou de la base : modules connus et niveaux valides seulement. */
export function normalizePermissions(raw: unknown): Permissions {
  const out: Permissions = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (isModuleId(k) && (v === "read" || v === "write")) out[k] = v;
  }
  return out;
}

/** Résumé lisible : « Écriture : Catalogue, Stocks · Lecture : Commandes ». */
export function summarizePermissions(perms: Permissions): string {
  const w = MODULES.filter((m) => perms[m.id] === "write").map((m) => m.label);
  const r = MODULES.filter((m) => perms[m.id] === "read").map((m) => m.label);
  const parts = [w.length ? `Écriture : ${w.join(", ")}` : "", r.length ? `Lecture : ${r.join(", ")}` : ""].filter(Boolean);
  return parts.join(" · ") || "Aucun accès";
}

/** Profils proposés en un clic (créés comme des profils ordinaires, modifiables ensuite). */
export const PROFILE_TEMPLATES: { name: string; description: string; permissions: Permissions }[] = [
  { name: "Superviseur", description: "Supervise l'activité : consulte catalogue, stocks, clients, revendeurs, statistiques, marketing et WhatsApp ; traite les commandes et la livraison. Pas d'accès aux finances ni aux réglages.", permissions: { catalogue: "read", commandes: "write", clients: "read", revendeurs: "read", livraison: "write", stocks: "read", statistiques: "read", marketing: "read", whatsapp: "read" } },
  { name: "Comptable", description: "Comptabilité et finances ; consultation des ventes et des clients.", permissions: { comptabilite: "write", statistiques: "read", commandes: "read", clients: "read" } },
  { name: "Gestionnaire de stock", description: "Catalogue et stocks ; consultation des commandes.", permissions: { catalogue: "write", stocks: "write", commandes: "read" } },
  { name: "Support client", description: "Clients, commandes, WhatsApp ; consultation de la livraison.", permissions: { clients: "write", commandes: "write", whatsapp: "write", livraison: "read" } },
  { name: "Responsable marketing", description: "Contenu, offres, codes promo, WhatsApp ; consultation du catalogue et des statistiques.", permissions: { marketing: "write", whatsapp: "write", catalogue: "read", statistiques: "read" } },
  { name: "Logisticien", description: "Livreurs et livraisons ; consultation des commandes et des stocks.", permissions: { livraison: "write", commandes: "read", stocks: "read" } },
  { name: "Responsable revendeurs", description: "Réseau de revendeurs ; consultation des commandes et des clients.", permissions: { revendeurs: "write", commandes: "read", clients: "read" } },
  { name: "Consultation seule", description: "Lecture de tous les modules, aucune modification.", permissions: Object.fromEntries(MODULE_IDS.filter((m) => m !== "utilisateurs").map((m) => [m, "read"])) as Permissions },
];
