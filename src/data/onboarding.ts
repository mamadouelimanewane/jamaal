/**
 * Checklist d'onboarding consultant.
 * Les étapes "auto" sont calculées dynamiquement ; les autres sont manuelles (localStorage).
 */

export type OnboardingStepId =
  | "profil"
  | "lien"
  | "premiere-commande"
  | "outils"
  | "filleul"
  | "formation";

export interface OnboardingStep {
  id: OnboardingStepId;
  title: string;
  description: string;
  /** Lien interne optionnel */
  href?: string;
  /** Si true, validé automatiquement selon les données BDD */
  auto: boolean;
}

export const onboardingSteps: OnboardingStep[] = [
  {
    id: "profil",
    title: "Compléter mon profil",
    description: "Nom, ville, WhatsApp et slug de lien personnel renseignés.",
    href: "/admin",
    auto: true,
  },
  {
    id: "lien",
    title: "Partager mon lien personnel",
    description: "Envoyer /c/votre-slug à au moins un contact (WhatsApp, story…).",
    href: "/admin/outils",
    auto: false,
  },
  {
    id: "outils",
    title: "Découvrir les outils de vente",
    description: "Consulter les scripts WhatsApp et le mini-catalogue.",
    href: "/admin/outils",
    auto: false,
  },
  {
    id: "premiere-commande",
    title: "Passer ma première commande client",
    description: "Une commande rattachée à votre compte (site ou saisie manuelle).",
    href: "/admin/mes-commandes",
    auto: true,
  },
  {
    id: "filleul",
    title: "Parrainer un consultant",
    description: "Au moins un filleul actif dans votre équipe.",
    href: "/admin",
    auto: true,
  },
  {
    id: "formation",
    title: "Lire le guide de démarrage",
    description: "Parcourir les conseils produits et techniques de vente.",
    href: "/admin/formation",
    auto: false,
  },
];

export const formationArticles = [
  {
    id: "guide-demarrage",
    title: "Guide de démarrage consultant",
    excerpt: "Les 7 premiers jours : profil, lien, premiers messages, première vente.",
    content: [
      "1. Complétez votre profil (WhatsApp, ville, slug).",
      "2. Copiez votre lien personnel depuis Outils de vente.",
      "3. Envoyez 5 messages de premier contact (script fourni) à des proches.",
      "4. Proposez un échantillon : c’est le meilleur levier pour convertir.",
      "5. Après chaque commande, remerciez et demandez un avis 3–5 jours plus tard.",
      "6. Partagez une story ou un statut WhatsApp 2–3 fois par semaine.",
      "7. Proposez le métier de consultant aux clients les plus enthousiastes.",
    ],
  },
  {
    id: "conseil-parfum",
    title: "Conseiller un parfum",
    excerpt: "Questions simples pour orienter femme / homme / notes.",
    content: [
      "Demandez l’occasion : tous les jours, soirée, cadeau ?",
      "Préférence : frais, floral, boisé, sucré, épicé ?",
      "Intensité souhaitée : discret ou sillage marqué ?",
      "Proposez 2 options maximum pour ne pas noyer le client.",
      "Rappelez la concentration élevée (extrait) et la tenue.",
      "Suggérez l’échantillon si le client hésite encore.",
    ],
  },
  {
    id: "whatsapp-bonnes-pratiques",
    title: "Bonnes pratiques WhatsApp",
    excerpt: "Ton, timing, relances — sans harceler.",
    content: [
      "Personnalisez toujours le prénom.",
      "Un seul message de relance à J+2, puis J+7 si vraiment engagé.",
      "Évitez les messages trop longs : 5–8 lignes max.",
      "Utilisez les scripts de la page Outils, puis adaptez à votre style.",
      "Répondez vite aux questions stock / livraison : c’est un facteur de confiance.",
      "Ne jamais dénigrer les grandes marques : positionnez JAMAAL comme alternative intelligente.",
    ],
  },
];
