/**
 * Annonces ciblées aux revendeurs, à partir des statistiques des boutiques : groupes (inactifs, sans vente…),
 * modèles de message et variables remplacées pour chaque revendeur. Pur : utilisable serveur et navigateur.
 */
export type OutreachRow = {
  id: string;
  name: string;
  slug: string | null;
  ready: boolean;
  visitors: number;
  whatsappClicks: number;
  sales: number;
  salesAmount: number;
  lastActivity: string | null;
};

export const SEGMENTS = [
  { key: "tous", label: "Tous", hint: "" },
  { key: "inactifs", label: "Aucune activité", hint: "ni visite de boutique, ni vente sur la période" },
  { key: "sans-vente", label: "Visites sans vente", hint: "des visiteurs mais aucune vente" },
  { key: "a-completer", label: "Boutique à compléter", hint: "sans boutique, sans photo ou sans coups de cœur" },
  { key: "actifs", label: "Ont vendu", hint: "au moins une vente sur la période" },
  { key: "top", label: "Top 10", hint: "les 10 meilleurs chiffres d'affaires" },
] as const;
export type SegmentKey = (typeof SEGMENTS)[number]["key"];

export function inSegment<T extends OutreachRow>(rows: T[], key: SegmentKey): T[] {
  switch (key) {
    case "inactifs":
      return rows.filter((r) => r.visitors === 0 && r.sales === 0);
    case "sans-vente":
      return rows.filter((r) => r.visitors > 0 && r.sales === 0);
    case "a-completer":
      return rows.filter((r) => !r.ready);
    case "actifs":
      return rows.filter((r) => r.sales > 0);
    case "top":
      return [...rows].filter((r) => r.salesAmount > 0).sort((a, b) => b.salesAmount - a.salesAmount).slice(0, 10);
    default:
      return rows;
  }
}

export const KINDS = {
  RAPPEL: "Rappel",
  AVERTISSEMENT: "Avertissement",
  FELICITATIONS: "Félicitations",
  INFO: "Information",
} as const;
export type OutreachKind = keyof typeof KINDS;

export const TEMPLATES: Record<OutreachKind, { title: string; body: string }> = {
  RAPPEL: {
    title: "{prenom}, on ne vous a pas vu ce mois-ci",
    body:
      "Bonjour {prenom},\n\nSur les {jours} derniers jours, votre boutique a eu {visiteurs} visite(s) et {ventes} vente(s). Les produits JAMAAL sont disponibles à Dakar : partagez dès aujourd'hui 2 ou 3 parfums à vos contacts depuis « Produits disponibles », votre lien de boutique fait le reste.\n\nVotre boutique : {boutique}\n\nBesoin d'aide ? Répondez à ce message.",
  },
  AVERTISSEMENT: {
    title: "{prenom}, votre activité JAMAAL est à l'arrêt",
    body:
      "Bonjour {prenom},\n\nAucune activité n'a été enregistrée sur votre compte depuis {jours} jours ({visiteurs} visite(s), {ventes} vente(s)). Pour rester revendeur actif et garder vos avantages, il faut au moins une vente par mois.\n\nContactez-nous si vous rencontrez une difficulté : nous pouvons vous aider à relancer vos ventes.",
  },
  FELICITATIONS: {
    title: "Bravo {prenom} !",
    body:
      "Bonjour {prenom},\n\nFélicitations : {ventes} vente(s) pour {ca} sur les {jours} derniers jours, et {visiteurs} visiteur(s) sur votre boutique. Continuez ainsi, vous faites partie des revendeurs les plus actifs du réseau !",
  },
  INFO: { title: "", body: "Bonjour {prenom},\n\n" },
};

export const VARIABLES = ["{prenom}", "{nom}", "{visiteurs}", "{ventes}", "{ca}", "{jours}", "{boutique}"] as const;

export function renderOutreach(text: string, r: OutreachRow, days: number, origin: string) {
  const first = r.name.trim().split(/\s+/)[0] ?? r.name;
  const vars: Record<string, string> = {
    "{prenom}": first,
    "{nom}": r.name,
    "{visiteurs}": r.visitors.toLocaleString("fr-FR"),
    "{ventes}": r.sales.toLocaleString("fr-FR"),
    "{ca}": `${r.salesAmount.toLocaleString("fr-FR")} F`,
    "{jours}": String(days),
    "{boutique}": r.slug ? `${origin}/c/${r.slug}` : "à créer dans « Ma boutique »",
  };
  return text.replace(/\{(prenom|nom|visiteurs|ventes|ca|jours|boutique)\}/g, (m) => vars[m] ?? m);
}

/** Lien wa.me vers le revendeur (le message part du téléphone de l'administrateur). Numéro sénégalais complété en 221. */
export function waHref(phone: string | null | undefined, text: string): string | null {
  let d = (phone ?? "").replace(/^.*wa\.me\//, "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 9 && /^[37]/.test(d)) d = `221${d}`;
  if (d.length < 9) return null;
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
}

/** Annonces visibles par un revendeur : celles pour tout le réseau et celles qui le ciblent. */
export const announcementsFor = (consultantId: string | null | undefined) =>
  consultantId ? { OR: [{ consultantIds: { isEmpty: true } }, { consultantIds: { has: consultantId } }] } : { consultantIds: { isEmpty: true } };

/** Titre et texte de l'annonce pour ce revendeur (version personnalisée s'il y en a une). */
export function announcementText(a: { title: string; body: string; personalized: unknown }, consultantId: string | null | undefined) {
  const p = consultantId && a.personalized && typeof a.personalized === "object" ? (a.personalized as Record<string, { title?: string; body?: string }>)[consultantId] : null;
  return { title: p?.title || a.title, body: p?.body || a.body };
}
