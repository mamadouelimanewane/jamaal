/**
 * Lien de paiement envoyé par le revendeur à son client : la commande est enregistrée en attente
 * de paiement, le client la règle en ligne (Wave ou Orange Money) sur la page publique de la commande,
 * puis le paiement est confirmé automatiquement (commissions, livraison, notifications). Pur, testé.
 */

/** Référence de départ d'une commande « lien de paiement » (remplacée par celle du paiement en ligne). */
export const PAY_LINK_REF = "lien";

const ONLINE = ["WAVE", "ORANGE_MONEY", "STRIPE"];

/** Commande saisie par un revendeur et payable en ligne par son client (payée ou non). */
export const isPayLinkOrder = (o: { paymentMethod?: string | null; channel?: string | null }) =>
  o.channel === "REVENDEUR" && ONLINE.includes(String(o.paymentMethod));

/** Adresse publique de la commande, où le client paie (l'identifiant n'est pas devinable). */
export const payLinkUrl = (origin: string, orderId: string) => `${origin.replace(/\/$/, "")}/commande/${orderId}`;

const F = (n: number) => `${n.toLocaleString("fr-FR").replace(/ | /g, " ")} F CFA`;

/** Message WhatsApp du revendeur à son client. */
export function payLinkMessage(o: { customerName: string; total: number; url: string; seller: string; ref: string }): string {
  const first = o.customerName.trim().split(/\s+/)[0] || "";
  return [
    `Bonjour ${first},`,
    `voici le lien pour régler votre commande JAMAAL n° ${o.ref} de ${F(o.total)} :`,
    o.url,
    "Paiement sécurisé par Wave ou Orange Money. Dès réception, votre commande est préparée.",
    `Merci ! ${o.seller}`,
  ].join("\n");
}
