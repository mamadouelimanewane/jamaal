/**
 * Messages WhatsApp automatiques modifiables (définitions et remplissage, sans accès à la base : utilisable
 * dans le navigateur). Admin › Journal WhatsApp.
 * Tant qu'un message n'a pas été modifié, le texte d'origine (codé dans chaque envoi) part tel quel ;
 * une fois modifié, le texte enregistré est utilisé, ses variables {prenom}, {numero}… remplacées.
 * La mention « Répondez STOP… » des relances reste ajoutée automatiquement (obligatoire).
 */

export type MessageKey =
  | "suivi_creee"
  | "suivi_reservation"
  | "suivi_acompte"
  | "suivi_payee"
  | "suivi_confirmee"
  | "suivi_expediee"
  | "suivi_annulee"
  | "suivi_livree"
  | "paiement_echoue"
  | "relance45"
  | "anniversaire"
  | "panier"
  | "avis"
  | "retrait_verse"
  | "carte_cadeau"
  | "carte_cadeau_acheteur"
  | "abonnement_rappel"
  | "abonnement_commande";

export type MessageDef = { group: string; label: string; when: string; vars: Record<string, string>; text: string };

/** Textes d'origine (identiques aux envois codés) et variables disponibles. */
export const WA_MESSAGES: Record<MessageKey, MessageDef> = {
  suivi_creee: {
    group: "Suivi de commande",
    label: "Commande enregistrée",
    when: "Dès qu'une commande est passée sur le site (bouton « Payer » ou « Suivre »).",
    vars: { prenom: "Prénom du client", numero: "N° de commande", montant: "Montant total", paiement: "Phrase sur le paiement (reçu ou à faire)" },
    text: "Bonjour {prenom}, merci pour votre commande JAMAAL n° {numero} ({montant}).{paiement}\nRépondez à ce message pour toute question.",
  },
  suivi_reservation: {
    group: "Suivi de commande",
    label: "Réservation enregistrée",
    when: "Réservation d'un produit à commander (acompte demandé).",
    vars: { prenom: "Prénom du client", numero: "N° de réservation", acompte: "Acompte à régler", reste: "Reste à payer à l'arrivée" },
    text: "Bonjour {prenom}, votre réservation JAMAAL n° {numero} est enregistrée. Pour la confirmer, réglez l'acompte de {acompte} (reste {reste} à l'arrivée du produit). Dès réception, nous commandons votre produit et vous écrivons ici.",
  },
  suivi_acompte: {
    group: "Suivi de commande",
    label: "Acompte reçu",
    when: "L'acompte d'une réservation est payé.",
    vars: { prenom: "Prénom du client", numero: "N° de réservation", acompte: "Montant versé", reste: "Reste à payer", delai: "Phrase « Délai annoncé : … » (si connu)" },
    text: "Acompte reçu ✅ Merci {prenom} ! Votre réservation JAMAAL n° {numero} est confirmée. Montant versé : {acompte}. Reste à payer à l'arrivée du produit : {reste}.{delai} Nous vous prévenons dès que votre produit est arrivé.",
  },
  suivi_payee: {
    group: "Suivi de commande",
    label: "Paiement reçu",
    when: "Le paiement en ligne (Wave, Orange Money…) est confirmé.",
    vars: { prenom: "Prénom du client", numero: "N° de commande", montant: "Montant total" },
    text: "Paiement reçu ✅ Merci {prenom} ! Votre commande n° {numero} ({montant}) est en préparation.",
  },
  suivi_confirmee: {
    group: "Suivi de commande",
    label: "Commande confirmée",
    when: "L'équipe confirme la commande.",
    vars: { prenom: "Prénom du client", numero: "N° de commande" },
    text: "Bonne nouvelle {prenom} : votre commande n° {numero} est confirmée et en préparation.",
  },
  suivi_expediee: {
    group: "Suivi de commande",
    label: "Commande expédiée",
    when: "La commande part en livraison ou chez le revendeur.",
    vars: { prenom: "Prénom du client", numero: "N° de commande", livraison: "« et arrive bientôt » ou « chez votre revendeur… »" },
    text: "Votre commande JAMAAL n° {numero} est expédiée {livraison}.",
  },
  suivi_annulee: {
    group: "Suivi de commande",
    label: "Commande annulée",
    when: "La commande est annulée.",
    vars: { prenom: "Prénom du client", numero: "N° de commande" },
    text: "Votre commande JAMAAL n° {numero} a été annulée. Si c'est une erreur ou pour en repasser une, répondez simplement à ce message.",
  },
  suivi_livree: {
    group: "Suivi de commande",
    label: "Commande remise",
    when: "Commande remise au client (hors livreurs JAMAAL, qui ont leur propre message).",
    vars: { prenom: "Prénom du client", numero: "N° de commande" },
    text: "Votre commande JAMAAL n° {numero} vous a été remise. Merci {prenom}, et à très vite !",
  },
  paiement_echoue: {
    group: "Suivi de commande",
    label: "Paiement échoué",
    when: "Le paiement en ligne n'a pas abouti (bouton « Réessayer le paiement »).",
    vars: { prenom: "Prénom du client", montant: "Montant total" },
    text: "Bonjour {prenom}, le paiement de votre commande JAMAAL ({montant}) n'a pas abouti. Vous pouvez réessayer, ou payer à la livraison si l'option est proposée. Répondez à ce message si besoin.",
  },
  relance45: {
    group: "Relances clients",
    label: "Rappel 45 jours après l'achat",
    when: "Chaque soir, pour les achats d'il y a 45 jours (sauf nouvelle commande depuis).",
    vars: { prenom: "Prénom du client", produit: "Produit acheté", lien: "Lien pour recommander", signature: "Revendeur ou « L'équipe JAMAAL »" },
    text: "Bonjour {prenom} 🌸\nCela fait environ 45 jours que vous avez pris *{produit}*. Votre flacon est bientôt fini ?\nOn vous le prépare : {lien}\nOu répondez simplement à ce message pour commander.\n{signature}",
  },
  anniversaire: {
    group: "Relances clients",
    label: "Anniversaire du client",
    when: "Le jour de l'anniversaire (code -10 % valable 15 jours).",
    vars: { prenom: "Prénom du client", code: "Code cadeau", jours: "Durée de validité (jours)", lien: "Lien vers la boutique" },
    text: "Joyeux anniversaire {prenom} ! 🎂✨\nToute l'équipe JAMAAL vous souhaite une très belle journée.\nPour l'occasion : *-10 %* sur votre prochaine commande avec le code *{code}* (valable {jours} jours) : {lien}",
  },
  panier: {
    group: "Relances clients",
    label: "Panier abandonné",
    when: "Panier commencé sans commande depuis 3 h à 48 h.",
    vars: { prenom: "Prénom du client", articles: "Articles du panier", lien: "Lien vers le panier" },
    text: "Bonjour {prenom} 👋\nVotre panier JAMAAL vous attend : {articles}.\nFinalisez ici : {lien}\nOu répondez à ce message : on prend votre commande directement sur WhatsApp.",
  },
  avis: {
    group: "Relances clients",
    label: "Demande d'avis",
    when: "Environ 2 jours après la livraison.",
    vars: { prenom: "Prénom du client", produits: "« *Nom du produit* » ou « vos produits »", lien: "Lien pour donner son avis" },
    text: "Bonjour {prenom} 🌸\nVous avez reçu {produits} il y a quelques jours : qu'en pensez-vous ?\nVotre avis (et une photo si vous voulez 📸) aide beaucoup les autres clients : {lien}\nMerci ! L'équipe JAMAAL",
  },
  retrait_verse: {
    group: "Revendeurs et livreurs",
    label: "Retrait versé",
    when: "Un retrait du wallet est envoyé sur Wave ou Orange Money.",
    vars: { montant: "Montant versé", compte: "Wave ou Orange Money (et numéro)", detail: "Les ventes qui composent le montant (produit, acheteur)" },
    text: "✅ Retrait versé : {montant} envoyés sur {compte}.\n{detail}\nMerci pour votre travail !",
  },
  carte_cadeau: {
    group: "Cadeaux et abonnements",
    label: "Carte cadeau reçue",
    when: "Une carte cadeau payée est envoyée à la personne qui la reçoit.",
    vars: { prenom: "Prénom du destinataire", expediteur: "Qui l'offre", montant: "Montant de la carte", occasion: "Occasion (Tabaski, mariage…)", message: "Message de l'expéditeur", code: "Code à utiliser", lien: "Lien pour choisir" },
    text: "🎁 Bonjour {prenom}, {expediteur} vous offre une carte cadeau JAMAAL de {montant}{occasion} !\n{message}\nVotre code : *{code}*. Choisissez vos parfums et soins, livrés chez vous : {lien}",
  },
  carte_cadeau_acheteur: {
    group: "Cadeaux et abonnements",
    label: "Carte cadeau envoyée (acheteur)",
    when: "Confirmation à la personne qui a acheté la carte cadeau.",
    vars: { prenom: "Prénom de l'acheteur", destinataire: "Prénom du destinataire", montant: "Montant", code: "Code de la carte" },
    text: "Merci {prenom} ! Votre carte cadeau de {montant} (code {code}) vient d'être envoyée à {destinataire} sur WhatsApp. 🎁",
  },
  abonnement_rappel: {
    group: "Cadeaux et abonnements",
    label: "Réassort : rappel 3 jours avant",
    when: "3 jours avant la prochaine commande d'un abonnement.",
    vars: { prenom: "Prénom du client", articles: "Produits de l'abonnement", jours: "Jours avant la commande", lien: "Lien pour gérer l'abonnement" },
    text: "Bonjour {prenom} 🌸 Votre réassort JAMAAL ({articles}) sera préparé dans {jours} jours. Rien à faire ! Pour décaler, changer ou mettre en pause : {lien}",
  },
  abonnement_commande: {
    group: "Cadeaux et abonnements",
    label: "Réassort : commande prête",
    when: "La commande d'un abonnement est créée (bouton de paiement).",
    vars: { prenom: "Prénom du client", numero: "N° de commande", montant: "Montant", remise: "Remise abonné", lien: "Lien pour gérer l'abonnement" },
    text: "Bonjour {prenom}, votre réassort JAMAAL n° {numero} est prêt : {montant} (remise abonné {remise} incluse). Payez en un clic avec le bouton ci-dessous. Gérer mon abonnement : {lien}",
  },
};

export const MESSAGE_KEYS = Object.keys(WA_MESSAGES) as MessageKey[];
export const isMessageKey = (k: unknown): k is MessageKey => typeof k === "string" && k in WA_MESSAGES;

/** Remplace les variables {nom} et nettoie les espaces laissés par une variable vide. Pur, testé. */
export function fillTemplate(template: string, vars: Record<string, string | number | null | undefined>): string {
  return template
    .replace(/\{(\w+)\}/g, (_, name: string) => (vars[name] == null ? "" : String(vars[name])))
    .split("\n")
    .map((line) => line.replace(/[ \t]{2,}/g, " ").replace(/[ \t]+$/g, ""))
    .join("\n")
    .trim();
}

/** Variables inconnues d'un texte (fautes de frappe : {prénom}…). Pur, testé. */
export function unknownVars(key: MessageKey, text: string): string[] {
  const known = new Set(Object.keys(WA_MESSAGES[key].vars));
  return [...new Set([...text.matchAll(/\{([^{}\s]{1,30})\}/g)].map((m) => m[1]))].filter((v) => !known.has(v));
}

