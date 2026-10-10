/** Présentation des états financiers (SYSCOHADA). Pur. */
import type { BalanceSheet, IncomeStatement } from "./reports";

export type IncomeRow = { ref: string; label: string; get: (s: IncomeStatement) => number; total?: boolean; sub?: boolean };

/** Présentation SYSCOHADA (soldes intermédiaires de gestion). Charges en négatif. */
export const INCOME_ROWS: IncomeRow[] = [
  { ref: "TA", label: "Ventes de marchandises", get: (s) => s.ventesBrutes },
  { ref: "", label: "Retours et remboursements", get: (s) => -s.retours, sub: true },
  { ref: "RA", label: "Achats de marchandises", get: (s) => -s.achats },
  { ref: "RB", label: "Variation de stocks de marchandises", get: (s) => -s.variation },
  { ref: "XA", label: "MARGE COMMERCIALE", get: (s) => s.margeCommerciale, total: true },
  { ref: "TC", label: "Frais de livraison facturés", get: (s) => s.servicesVendus },
  { ref: "XB", label: "CHIFFRE D'AFFAIRES", get: (s) => s.chiffreAffaires, total: true },
  { ref: "TH", label: "Autres produits", get: (s) => s.autresProduits },
  { ref: "RC", label: "Autres achats (emballages, fournitures)", get: (s) => -s.autresAchats },
  { ref: "RF", label: "Transports (dont livreurs)", get: (s) => -s.transports },
  { ref: "RG", label: "Services extérieurs", get: (s) => -s.servicesExterieurs },
  { ref: "", label: "dont commissions du réseau", get: (s) => -s.commissionsReseau, sub: true },
  { ref: "RI", label: "Impôts et taxes", get: (s) => -s.impotsTaxes },
  { ref: "RJ", label: "Autres charges", get: (s) => -s.autresCharges },
  { ref: "XC", label: "VALEUR AJOUTÉE", get: (s) => s.valeurAjoutee, total: true },
  { ref: "RK", label: "Charges de personnel", get: (s) => -s.personnel },
  { ref: "XD", label: "EXCÉDENT BRUT D'EXPLOITATION", get: (s) => s.ebe, total: true },
  { ref: "TJ", label: "Reprises", get: (s) => s.reprises },
  { ref: "RL", label: "Dotations aux amortissements", get: (s) => -s.dotations },
  { ref: "XE", label: "RÉSULTAT D'EXPLOITATION", get: (s) => s.resultatExploitation, total: true },
  { ref: "TK", label: "Produits financiers", get: (s) => s.produitsFinanciers },
  { ref: "RM", label: "Charges financières", get: (s) => -s.chargesFinancieres },
  { ref: "XF", label: "RÉSULTAT FINANCIER", get: (s) => s.resultatFinancier, total: true },
  { ref: "XG", label: "RÉSULTAT DES ACTIVITÉS ORDINAIRES", get: (s) => s.rao, total: true },
  { ref: "XH", label: "Résultat hors activités ordinaires", get: (s) => s.hao },
  { ref: "RS", label: "Impôt sur le résultat", get: (s) => -s.impot },
  { ref: "XI", label: "RÉSULTAT NET", get: (s) => s.resultatNet, total: true },
];

export type SheetRow = { label: string; get: (b: BalanceSheet) => number; total?: boolean; sub?: boolean };

export const ASSET_ROWS: SheetRow[] = [
  { label: "Immobilisations (valeur nette)", get: (b) => b.actif.immobilisations },
  { label: "valeur brute", get: (b) => b.actif.immoBrut, sub: true },
  { label: "amortissements", get: (b) => -b.actif.amortissements, sub: true },
  { label: "Stock de marchandises", get: (b) => b.actif.stocks },
  { label: "Fournisseurs débiteurs, avances versées", get: (b) => b.actif.fournisseursAvances },
  { label: "Clients", get: (b) => b.actif.clients },
  { label: "Autres créances (TVA récupérable, État…)", get: (b) => b.actif.autresCreances },
  { label: "Trésorerie (Wave, Orange Money, caisse, banque)", get: (b) => b.actif.tresorerie },
  { label: "TOTAL ACTIF", get: (b) => b.totalActif, total: true },
];

export const LIABILITY_ROWS: SheetRow[] = [
  { label: "Capital et compte de l'exploitant", get: (b) => b.passif.capital },
  { label: "Report à nouveau (résultats antérieurs)", get: (b) => b.passif.report },
  { label: "Résultat de l'exercice", get: (b) => b.passif.resultat },
  { label: "CAPITAUX PROPRES", get: (b) => b.passif.capitauxPropres, total: true },
  { label: "Emprunts", get: (b) => b.passif.emprunts },
  { label: "Fournisseurs", get: (b) => b.passif.fournisseurs },
  { label: "Clients, avances reçues", get: (b) => b.passif.clientsAvances },
  { label: "Dettes fiscales et sociales", get: (b) => b.passif.fiscalSocial },
  { label: "Wallets du réseau (revendeurs, livreurs)", get: (b) => b.passif.wallets },
  { label: "Autres dettes", get: (b) => b.passif.autresDettes },
  { label: "Trésorerie passif (découverts)", get: (b) => b.passif.tresoreriePassif },
  { label: "TOTAL PASSIF", get: (b) => b.totalPassif, total: true },
];
