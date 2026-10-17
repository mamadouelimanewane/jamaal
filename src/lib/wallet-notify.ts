/**
 * Notification dans l'application (cloche du menu) à chaque crédit de wallet : le vendeur, ses parrains,
 * le livreur voient immédiatement leur part, avec la commande concernée. Ne lève jamais d'erreur.
 * Le message WhatsApp, lui, est géré par alertWalletCredits (interrupteur « Alertes WhatsApp »).
 */
import { prisma } from "./prisma";

export interface WalletCreditNotice {
  ownerType: "CONSULTANT" | "LIVREUR";
  ownerId: string;
  amount: number;
  /** VENTE, NIVEAU_1, NIVEAU_2, PRIME_… ou LIVRAISON */
  level: string;
  orderId?: string | null;
  rate?: number;
  base?: number;
}

const fcfa = (n: number) => `${n.toLocaleString("fr-FR")} FCFA`;
const ref = (id: string) => id.slice(-8).toUpperCase();

const ROLE: Record<string, string> = {
  VENTE: "votre vente",
  NIVEAU_1: "une vente de votre équipe (niveau 1)",
  NIVEAU_2: "une vente de votre équipe (niveau 2)",
  LIVRAISON: "votre livraison",
};

/** Titre et texte de la notification (pur, testé). */
export function creditNotice(n: WalletCreditNotice): { title: string; message: string } {
  if (n.level.startsWith("PRIME_")) return { title: "Prime d'équipe créditée", message: `${fcfa(n.amount)} ont été crédités sur votre wallet : prime d'équipe. Retrait possible depuis « Mon wallet ».` };
  const order = n.orderId && !n.orderId.startsWith("PRIME-") ? ` (commande ${ref(n.orderId)})` : "";
  if (n.level === "LIVRAISON") return { title: "Part de livraison créditée", message: `${fcfa(n.amount)} ont été crédités sur votre wallet pour ${ROLE.LIVRAISON}${order}. Retrait possible depuis « Mon wallet ».` };
  const pct = n.rate ? `${n.rate} %${n.base ? ` de ${fcfa(n.base)}` : ""}, ` : "";
  return { title: "Commission créditée", message: `${fcfa(n.amount)} ont été crédités sur votre wallet : ${pct}pour ${ROLE[n.level] ?? "une vente"}${order}. Retrait possible depuis « Mon wallet ».` };
}

export async function notifyWalletCredits(notices: WalletCreditNotice[]): Promise<void> {
  if (!notices.length) return;
  try {
    const consultantIds = [...new Set(notices.filter((n) => n.ownerType === "CONSULTANT").map((n) => n.ownerId))];
    const livreurIds = [...new Set(notices.filter((n) => n.ownerType === "LIVREUR").map((n) => n.ownerId))];
    const users = await prisma.user.findMany({
      where: { OR: [{ consultantId: { in: consultantIds } }, { livreurId: { in: livreurIds } }] },
      select: { id: true, consultantId: true, livreurId: true },
    });
    const userOf = (n: WalletCreditNotice) => users.find((u) => (n.ownerType === "CONSULTANT" ? u.consultantId === n.ownerId : u.livreurId === n.ownerId))?.id;
    const data = notices.flatMap((n) => {
      const userId = userOf(n);
      if (!userId) return [];
      const { title, message } = creditNotice(n);
      return [{ userId, orderId: n.orderId && !n.orderId.startsWith("PRIME-") ? n.orderId : null, title, message }];
    });
    if (data.length) await prisma.notification.createMany({ data });
  } catch (e) {
    console.error("[wallet] notification de crédit", e);
  }
}
