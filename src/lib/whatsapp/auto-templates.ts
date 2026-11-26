/**
 * Mapping centralisé des 10 modèles officiels Meta (approuvés dans KwingoChat, langue "fr")
 * pour tous les envois automatiques JAMAAL hors fenêtre de 24 h.
 */
import type { WhatsAppKind } from "./index";

export const META_AUTO_TEMPLATES = {
  SUIVI_COMMANDE: "jamaal_suivi_commande",
  PAIEMENT_ECHEANCE: "jamaal_paiement_echeance",
  CARTE_CADEAU: "jamaal_carte_cadeau",
  ALERTE_CONSULTANT: "jamaal_alerte_consultant",
  ALERTE_EQUIPE: "jamaal_alerte_equipe",
  RELANCE_CLIENT: "jamaal_relance_client",
  ANNIVERSAIRE: "jamaal_anniversaire",
  DEMANDE_AVIS: "jamaal_demande_avis",
  KIT_MATIN: "jamaal_kit_matin",
} as const;

export type AutoTemplateBinding = {
  template: string;
  templateLanguage: string;
  templateVars: string[];
};

const SITE_FALLBACK = "https://www.jamaal.sn";

/** Nettoie une variable pour Meta (pas de sauts de ligne, tabulations ni 4+ espaces consécutifs). */
export function cleanTemplateVar(raw: string | number | null | undefined, maxLen = 280, fallback = "—"): string {
  const s = String(raw ?? "")
    .replace(/[\r\n\t]+/g, " · ")
    .replace(/ {4,}/g, "   ")
    .replace(/\s+·\s+·\s+/g, " · ")
    .trim();
  return (s || fallback).slice(0, maxLen);
}

function extractFirstUrl(text: string, ctaUrl?: string | null, fallback = SITE_FALLBACK): string {
  if (ctaUrl && /^https?:\/\//i.test(ctaUrl)) return ctaUrl.trim();
  const m = text.match(/https?:\/\/[^\s)]+/i);
  return m ? m[0].replace(/[.,;!?]+$/, "") : fallback;
}

function extractOrderRef(text: string): string {
  const m = text.match(/n°\s*([A-Z0-9-]{4,16})/i) || text.match(/commande\s+([A-Z0-9-]{6,16})/i);
  return m ? m[1].toUpperCase() : "JAMAAL";
}

function extractAmount(text: string): string {
  const m = text.match(/(\d[\d\s\u00A0\u202F]*\s*(?:FCFA|F\b|GMD|D))/i);
  return m ? cleanTemplateVar(m[1], 40) : "voir détail";
}

function extractFirstName(recipientName?: string | null, text?: string): string {
  const clean = (recipientName ?? "").trim();
  if (clean && !clean.startsWith("+")) return clean.split(/\s+/)[0] || "Client";
  if (text) {
    const m = text.match(/(?:Bonjour|Merci|Joyeux anniversaire)\s+([A-ZÀ-ÿa-z][A-Za-zÀ-ÿ'-]{1,24})/i);
    if (m && !/^(pour|votre|la|le|les|un|une)$/i.test(m[1])) return m[1];
  }
  return "Client";
}

function stripUrlsAndStop(text: string): string {
  return text
    .replace(/https?:\/\/[^\s)]+/gi, "")
    .replace(/\(?\s*Répondez\s+STOP[^)]*\)?\.?/gi, "")
    .replace(/\(?\s*Répondez\s+«\s*stop kit\s*»[^)]*\)?\.?/gi, "")
    .trim();
}

/**
 * Résout automatiquement le modèle Meta officiel et ses variables {{1}}..{{n}}
 * pour tout message automatique JAMAAL qui n'a pas fourni de template explicite.
 */
export function resolveAutoTemplate(opts: {
  kind: WhatsAppKind;
  text: string;
  recipientName?: string | null;
  cta?: { label: string; url: string } | null;
}): AutoTemplateBinding | null {
  const { kind, text, recipientName, cta } = opts;

  // Les réponses bot / conseiller dans la fenêtre 24h et les campagnes explicites gèrent leur propre mode
  if (kind === "bot" || kind === "conseiller" || kind === "campagne") {
    return null;
  }

  const firstName = extractFirstName(recipientName, text);
  const url = extractFirstUrl(text, cta?.url);
  const summary = cleanTemplateVar(stripUrlsAndStop(text), 320, "Notification JAMAAL Luxury");

  if (kind === "team" || kind === "resume") {
    const today = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", timeZone: "Africa/Dakar" });
    const title = kind === "resume" ? `Résumé du ${today}` : `Alerte du ${today}`;
    return {
      template: META_AUTO_TEMPLATES.ALERTE_EQUIPE,
      templateLanguage: "fr",
      templateVars: [title, summary, `${SITE_FALLBACK}/admin`],
    };
  }

  if (kind === "reseller" || kind === "livreur") {
    const lines = stripUrlsAndStop(text)
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const headline = cleanTemplateVar(lines[0] ?? summary, 160);
    const details = cleanTemplateVar(lines.slice(1).join(" · ") || "Consultez votre espace pour le détail complet", 260);
    return {
      template: META_AUTO_TEMPLATES.ALERTE_CONSULTANT,
      templateLanguage: "fr",
      templateVars: [firstName, headline, details, extractFirstUrl(text, cta?.url, `${SITE_FALLBACK}/admin`)],
    };
  }

  if (kind === "kit") {
    const prodMatch = text.match(/Produit du jour\s*:\s*\*?([^*\n.]+)\*?/i);
    const product = cleanTemplateVar(prodMatch?.[1] ?? "Sélection du jour JAMAAL Luxury", 120);
    return {
      template: META_AUTO_TEMPLATES.KIT_MATIN,
      templateLanguage: "fr",
      templateVars: [firstName, product, extractFirstUrl(text, cta?.url, `${SITE_FALLBACK}/admin/kit-marketing`)],
    };
  }

  if (kind === "avis") {
    const prodMatch = text.match(/reçu\s+\*?([^*\n:]+?)\*?\s+il y a/i);
    const product = cleanTemplateVar(prodMatch?.[1] ?? "vos produits JAMAAL Luxury", 120);
    return {
      template: META_AUTO_TEMPLATES.DEMANDE_AVIS,
      templateLanguage: "fr",
      templateVars: [firstName, product, url],
    };
  }

  if (kind === "relance") {
    if (/anniversaire/i.test(text)) {
      const codeMatch = text.match(/code\s+\*?([A-Z0-9-]{4,24})\*?/i);
      const code = cleanTemplateVar(codeMatch?.[1] ?? "JAMAAL10", 30);
      return {
        template: META_AUTO_TEMPLATES.ANNIVERSAIRE,
        templateLanguage: "fr",
        templateVars: [firstName, code, "15", extractFirstUrl(text, cta?.url, `${SITE_FALLBACK}/collections`)],
      };
    }
    return {
      template: META_AUTO_TEMPLATES.RELANCE_CLIENT,
      templateLanguage: "fr",
      templateVars: [firstName, summary, extractFirstUrl(text, cta?.url, `${SITE_FALLBACK}/collections`), "L'équipe JAMAAL Luxury"],
    };
  }

  if (kind === "suivi") {
    const orderRef = extractOrderRef(text);
    const isPayment = /paiement|échéance|echeance|acompte|payer|wave|orange money/i.test(text);
    if (isPayment) {
      return {
        template: META_AUTO_TEMPLATES.PAIEMENT_ECHEANCE,
        templateLanguage: "fr",
        templateVars: [firstName, orderRef, extractAmount(text), summary, url],
      };
    }
    return {
      template: META_AUTO_TEMPLATES.SUIVI_COMMANDE,
      templateLanguage: "fr",
      templateVars: [firstName, orderRef, summary, url],
    };
  }

  // kind === "client" ou "test"
  return {
    template: META_AUTO_TEMPLATES.SUIVI_COMMANDE,
    templateLanguage: "fr",
    templateVars: [firstName, extractOrderRef(text), summary, url],
  };
}
