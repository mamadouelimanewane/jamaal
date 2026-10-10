/**
 * Plan comptable JAMAAL, conforme au SYSCOHADA révisé (Sénégal / OHADA), réduit aux comptes
 * utiles à une activité de négoce avec réseau de revendeurs et livraison. L'admin peut ajouter
 * ses propres sous-comptes (Admin › Comptabilité › Réglages). Pur (utilisable partout).
 */

export type AccountDef = { code: string; label: string };

export const DEFAULT_ACCOUNTS: AccountDef[] = [
  // Classe 1 : capitaux
  { code: "101", label: "Capital" },
  { code: "104", label: "Compte de l'exploitant (apports et prélèvements)" },
  { code: "121", label: "Report à nouveau" },
  { code: "131", label: "Résultat net de l'exercice" },
  { code: "162", label: "Emprunts auprès des établissements de crédit" },
  // Classe 2 : immobilisations
  { code: "244", label: "Matériel et mobilier de bureau" },
  { code: "245", label: "Matériel de transport" },
  { code: "2844", label: "Amortissements du matériel et mobilier" },
  { code: "2845", label: "Amortissements du matériel de transport" },
  // Classe 3 : stocks
  { code: "311", label: "Stock de marchandises" },
  // Classe 4 : tiers
  { code: "401", label: "Fournisseurs (Chogan et autres)" },
  { code: "4091", label: "Fournisseurs, avances versées" },
  { code: "411", label: "Clients" },
  { code: "421", label: "Personnel, rémunérations dues" },
  { code: "431", label: "Sécurité sociale (CSS, IPRES)" },
  { code: "441", label: "État, impôt sur les bénéfices" },
  { code: "4431", label: "TVA facturée sur ventes" },
  { code: "4441", label: "État, TVA due" },
  { code: "4449", label: "État, crédit de TVA à reporter" },
  { code: "4452", label: "TVA récupérable sur achats et charges" },
  { code: "447", label: "État, impôts retenus à la source" },
  { code: "4671", label: "Revendeurs, wallets (commissions et primes)" },
  { code: "4672", label: "Livreurs, wallets (parts de livraison)" },
  { code: "471", label: "Compte d'attente" },
  // Classe 5 : trésorerie
  { code: "521", label: "Banque" },
  { code: "5521", label: "Wave" },
  { code: "5522", label: "Orange Money" },
  { code: "553", label: "Paiements par carte (Stripe)" },
  { code: "571", label: "Caisse (espèces)" },
  { code: "585", label: "Virements de fonds internes" },
  // Classe 6 : charges
  { code: "601", label: "Achats de marchandises" },
  { code: "6031", label: "Variation des stocks de marchandises" },
  { code: "605", label: "Autres achats (emballages, fournitures)" },
  { code: "612", label: "Transports sur ventes (livreurs)" },
  { code: "618", label: "Autres frais de transport et déplacements" },
  { code: "622", label: "Locations et charges locatives" },
  { code: "624", label: "Entretien et réparations" },
  { code: "625", label: "Primes d'assurance" },
  { code: "627", label: "Publicité, publications, relations publiques" },
  { code: "628", label: "Frais de télécommunications et internet" },
  { code: "631", label: "Frais bancaires et de mobile money" },
  { code: "6322", label: "Commissions sur ventes (réseau de revendeurs)" },
  { code: "6324", label: "Honoraires (comptable, juriste…)" },
  { code: "638", label: "Autres charges externes" },
  { code: "641", label: "Impôts et taxes (patente, CGU…)" },
  { code: "658", label: "Charges diverses" },
  { code: "661", label: "Rémunérations du personnel" },
  { code: "664", label: "Charges sociales" },
  { code: "671", label: "Intérêts des emprunts" },
  { code: "681", label: "Dotations aux amortissements" },
  { code: "891", label: "Impôt sur les bénéfices" },
  // Classe 7 : produits
  { code: "701", label: "Ventes de marchandises" },
  { code: "7019", label: "Retours et remboursements sur ventes" },
  { code: "7071", label: "Frais de livraison facturés" },
  { code: "758", label: "Produits divers (acomptes conservés, écarts)" },
  { code: "771", label: "Produits financiers" },
];

export const CLASS_LABELS: Record<string, string> = {
  "1": "Capitaux",
  "2": "Immobilisations",
  "3": "Stocks",
  "4": "Tiers",
  "5": "Trésorerie",
  "6": "Charges",
  "7": "Produits",
  "8": "Hors activités ordinaires",
};

export const JOURNALS: Record<string, string> = {
  VE: "Ventes",
  BQ: "Trésorerie (encaissements et décaissements)",
  AC: "Achats et dépenses",
  RE: "Réseau (commissions, livreurs, wallets)",
  ST: "Stocks",
  OD: "Opérations diverses",
  AN: "À-nouveaux (ouverture)",
};

/** Comptes de trésorerie, dans l'ordre d'affichage. */
export const CASH_ACCOUNTS = ["5521", "5522", "571", "521", "553"] as const;

/** Canal de paiement (dépenses, remboursements…) → compte de trésorerie. */
export const CHANNELS: Record<string, { label: string; account: string }> = {
  CAISSE: { label: "Espèces (caisse)", account: "571" },
  WAVE: { label: "Wave", account: "5521" },
  ORANGE_MONEY: { label: "Orange Money", account: "5522" },
  BANQUE: { label: "Banque (virement, chèque)", account: "521" },
  CARTE: { label: "Carte (Stripe)", account: "553" },
};
export const channelAccount = (channel: string | null | undefined) => CHANNELS[channel ?? ""]?.account ?? "571";

/** Moyen de paiement d'une commande → compte de trésorerie (null : pas de trésorerie, ex. wallet). */
export function paymentMethodAccount(method: string): string | null {
  switch (method) {
    case "WAVE":
      return "5521";
    case "ORANGE_MONEY":
      return "5522";
    case "STRIPE":
      return "553";
    case "WALLET":
      return null;
    default:
      return "571"; // paiement à la livraison : espèces encaissées par le livreur ou le revendeur
  }
}

/** Fournisseur de paiement d'un wallet (Wave / Orange Money) → compte de trésorerie. */
export const walletProviderAccount = (p: string | null | undefined) => (p === "ORANGE_MONEY" ? "5522" : p === "WAVE" ? "5521" : "571");

/** Comptes proposés pour une dépense (classe 6, plus le règlement d'un fournisseur ou d'une immobilisation). */
export const EXPENSE_ACCOUNTS = ["601", "605", "612", "618", "622", "624", "625", "627", "628", "631", "6324", "638", "641", "658", "661", "664", "671", "891", "244", "245", "401", "421", "431", "441", "4441"];

/** Anciennes catégories de dépense → compte. */
export const LEGACY_CATEGORY_ACCOUNT: Record<string, string> = {
  "Achat stock": "601",
  Livraison: "612",
  Marketing: "627",
  Salaires: "661",
  Loyer: "622",
  Autre: "638",
};

export function accountClass(code: string) {
  return code.charAt(0);
}

/** Comptes de bilan (classes 1 à 5) / de gestion (6, 7, 8). */
export const isBalanceSheetAccount = (code: string) => "12345".includes(accountClass(code));

export function mergeAccounts(custom: AccountDef[]): AccountDef[] {
  const map = new Map(DEFAULT_ACCOUNTS.map((a) => [a.code, a]));
  for (const c of custom) if (/^[1-8]\d{1,7}$/.test(c.code) && c.label.trim()) map.set(c.code, { code: c.code, label: c.label.trim().slice(0, 80) });
  return [...map.values()].sort((a, b) => a.code.localeCompare(b.code));
}

/** Libellé d'un compte : exact, sinon celui du compte parent le plus proche. */
export function labelFor(code: string, accounts: AccountDef[]): string {
  const map = new Map(accounts.map((a) => [a.code, a.label]));
  for (let i = code.length; i > 0; i--) {
    const l = map.get(code.slice(0, i));
    if (l) return i === code.length ? l : `${l} (${code})`;
  }
  return `Compte ${code}`;
}

export function isValidAccount(code: string) {
  return /^[1-8]\d{1,7}$/.test(code);
}
