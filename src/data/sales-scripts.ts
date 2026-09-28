/**
 * Scripts WhatsApp / messages de vente prêts à copier pour les consultants.
 * Personnalisables via {{name}}, {{link}}, {{product}}.
 */

export type ScriptCategory =
  | "premier-contact"
  | "relance"
  | "post-achat"
  | "recrutement"
  | "promo";

export interface SalesScript {
  id: string;
  category: ScriptCategory;
  title: string;
  description: string;
  body: string;
}

export const SCRIPT_CATEGORIES: { id: ScriptCategory; label: string }[] = [
  { id: "premier-contact", label: "Premier contact" },
  { id: "relance", label: "Relance" },
  { id: "post-achat", label: "Après achat" },
  { id: "recrutement", label: "Recrutement" },
  { id: "promo", label: "Promo / story" },
];

export const salesScripts: SalesScript[] = [
  {
    id: "pc-1",
    category: "premier-contact",
    title: "Présentation courte",
    description: "Message d'ouverture simple et chaleureux.",
    body: `Bonjour {{name}} 👋

Je suis consultant·e JAMAAL. On propose des parfums inspirés des grandes maisons, à prix juste, avec une vraie tenue.

Si tu veux découvrir, voici mon lien : {{link}}

Je peux aussi te conseiller selon tes goûts (frais, boisé, floral…). Dis-moi ce que tu recherches !`,
  },
  {
    id: "pc-2",
    category: "premier-contact",
    title: "Présentation + échantillon",
    description: "Met l'accent sur l'essai à petit prix.",
    body: `Salut {{name}} !

Chez JAMAAL, tu peux commencer par un échantillon pour tester avant d'investir.

Parfums concentrés, inspirés des grandes maisons — sans le prix des grandes marques.

Mon catalogue : {{link}}

Tu préfères plutôt femme, homme, ou unisexe ?`,
  },
  {
    id: "rel-1",
    category: "relance",
    title: "Relance douce (J+2)",
    description: "Sans pression, après un premier échange.",
    body: `Re-bonjour {{name}} 🙂

Je me permets de te relancer au cas où tu aurais encore une question sur les parfums JAMAAL.

Si tu veux, je peux te proposer 2–3 références selon ce que tu aimes porter.

Lien : {{link}}`,
  },
  {
    id: "rel-2",
    category: "relance",
    title: "Relance panier / intérêt",
    description: "Quand la personne a montré de l'intérêt.",
    body: `Hello {{name}},

Tu m'avais dit être intéressé·e par {{product}}.

Il reste du stock et je peux t'accompagner pour la commande / la livraison.

Dis-moi si tu veux qu'on finalise 😊
{{link}}`,
  },
  {
    id: "pa-1",
    category: "post-achat",
    title: "Remerciement + suivi",
    description: "Juste après la commande.",
    body: `Merci pour ta commande {{name}} ! 🙏

Elle est bien enregistrée. Je te tiens au courant pour la livraison.

Si tu as la moindre question sur l'application du parfum ou le choix d'un prochain flacon, je suis là.

À très vite !`,
  },
  {
    id: "pa-2",
    category: "post-achat",
    title: "Demande d'avis",
    description: "Quelques jours après la réception.",
    body: `Bonjour {{name}},

J'espère que ton parfum JAMAAL te plaît !

Si tu as 30 secondes, ton avis m'aide beaucoup (et aide d'autres clients à se décider).

Tu peux me répondre ici en quelques mots : tenue, sillage, ce que tu as aimé…

Merci infiniment 🌸`,
  },
  {
    id: "rec-1",
    category: "recrutement",
    title: "Devenir consultant·e",
    description: "Proposition de rejoindre le réseau.",
    body: `Salut {{name}},

Tu aimes les parfums et tu partages déjà souvent des bons plans autour de toi ?

Chez JAMAAL, on peut devenir consultant·e indépendant·e : catalogue, outils, commissions, et un vrai accompagnement.

Si tu veux en savoir plus (sans engagement), je t'explique en 5 minutes.

Lien inscription / info : {{link}}`,
  },
  {
    id: "pro-1",
    category: "promo",
    title: "Story / statut WhatsApp",
    description: "Court, pour story ou statut.",
    body: `✨ Parfums JAMAAL — inspirés des grandes maisons, prix juste.

Échantillons dispo · Conseil personnalisé · Livraison

Commande via mon lien : {{link}}`,
  },
  {
    id: "pro-2",
    category: "promo",
    title: "Mise en avant produit",
    description: "Pour pousser une référence précise.",
    body: `🔥 Coup de cœur : {{product}}

Une fragrance JAMAAL qui cartonne en ce moment.

Tu veux les notes olfactives ou passer commande ?
{{link}}`,
  },
];

/** Remplace les placeholders du script. */
export function fillScript(
  body: string,
  vars: { name?: string; link?: string; product?: string }
): string {
  return body
    .replace(/\{\{name\}\}/g, vars.name?.trim() || "toi")
    .replace(/\{\{link\}\}/g, vars.link?.trim() || "[ton lien JAMAAL]")
    .replace(/\{\{product\}\}/g, vars.product?.trim() || "ce parfum");
}
