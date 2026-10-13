/**
 * Alertes WhatsApp de l'équipe et des revendeurs (interrupteur « Alertes WhatsApp ») :
 * - revendeur : commission ou prime créditée, retrait versé, nouveau filleul, défi presque atteint ;
 * - équipe JAMAAL : avis négatif, paiement échoué.
 * Toujours en complément des notifications du back-office. Ne lève jamais d'erreur.
 */
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { automationEnabled, claimAutomation } from "@/lib/automation-settings";
import { activeChallenges, challengeStandings, METRIC_LABELS, type ChallengeMetric } from "@/lib/challenges";
import { getSiteUrl } from "@/lib/site-url";
import { notifyResellerWhatsApp, notifyTeamWhatsApp, sendWhatsApp } from "./index";

const fcfa = (n: number) => `${n.toLocaleString("fr-FR")} FCFA`;

function later(task: () => Promise<unknown>) {
  const safe = () => task().catch((e) => console.error("[whatsapp] alerte", e));
  try {
    after(safe);
  } catch {
    void safe();
  }
}

async function on() {
  return automationEnabled("alerts");
}

/** Commissions / primes créditées sur les wallets : un message par revendeur. */
export function alertWalletCredits(credits: { consultantId: string; amount: number; prime: boolean }[]) {
  if (!credits.length) return;
  later(async () => {
    if (!(await on())) return;
    const byOwner = new Map<string, { total: number; prime: boolean }>();
    for (const c of credits) {
      const cur = byOwner.get(c.consultantId) ?? { total: 0, prime: false };
      byOwner.set(c.consultantId, { total: cur.total + c.amount, prime: cur.prime || c.prime });
    }
    for (const [id, v] of byOwner) notifyResellerWhatsApp(id, `💰 +${fcfa(v.total)} crédités sur votre wallet JAMAAL (${v.prime ? "commissions et primes" : "commissions"}). Retrait possible vers Wave ou Orange Money depuis « Mon wallet ».`);
  });
}

/** Retrait versé (automatiquement ou à la main) : revendeur ou livreur. */
export function alertWithdrawalPaid(txId: string) {
  later(async () => {
    if (!(await on())) return;
    const t = await prisma.walletTransaction.findUnique({ where: { id: txId }, select: { amount: true, ownerType: true, ownerId: true, phone: true, provider: true } });
    if (!t) return;
    const to =
      t.ownerType === "CONSULTANT"
        ? (await prisma.consultant.findUnique({ where: { id: t.ownerId }, select: { whatsapp: true } }))?.whatsapp
        : (await prisma.livreur.findUnique({ where: { id: t.ownerId }, select: { phone: true } }))?.phone;
    if (!to) return;
    const via = t.provider === "WAVE" ? "Wave" : t.provider === "ORANGE_MONEY" ? "Orange Money" : "votre compte";
    await sendWhatsApp({ to, kind: "reseller", text: `✅ Retrait versé : ${fcfa(Math.abs(t.amount))} envoyés sur ${via}${t.phone ? ` (${t.phone})` : ""}. Merci pour votre travail !` });
  });
}

/** Nouveau filleul accepté dans l'équipe d'un revendeur. */
export function alertNewTeamMember(sponsorId: string, member: { name: string; city: string }) {
  later(async () => {
    if (!(await on())) return;
    notifyResellerWhatsApp(sponsorId, `🎉 ${member.name} (${member.city}) rejoint votre équipe JAMAAL ! Souhaitez-lui la bienvenue et aidez-le à faire sa première vente : vous touchez une commission sur ses ventes.`);
  });
}

/** Avis client négatif (1 ou 2 étoiles) : l'équipe rappelle le client. */
export function alertBadReview(r: { productName: string; rating: number; author: string; comment: string }) {
  if (r.rating > 2) return;
  later(async () => {
    if (!(await on())) return;
    notifyTeamWhatsApp(`⚠️ Avis ${r.rating}/5 sur ${r.productName} par ${r.author} : « ${r.comment.slice(0, 200)} ». À rappeler. Admin > Avis.`);
  });
}

/** Paiement échoué : l'équipe est prévenue, le client reçoit le bouton pour réessayer. */
export function alertPaymentFailed(orderId: string, method: string) {
  later(async () => {
    if (!(await on())) return;
    const o = await prisma.order.findUnique({ where: { id: orderId }, select: { customerName: true, customerPhone: true, total: true, paymentStatus: true } });
    if (!o || o.paymentStatus === "PAYE") return;
    if (!(await claimAutomation(`paiement-echec:${orderId}`))) return;
    notifyTeamWhatsApp(`❌ Paiement ${method} échoué : ${o.customerName}, ${fcfa(o.total)} (commande ${orderId.slice(-8).toUpperCase()}). Le client a reçu un lien pour réessayer.`);
    if (o.customerPhone) {
      const site = await getSiteUrl().catch(() => "");
      await sendWhatsApp({
        to: o.customerPhone,
        kind: "suivi",
        text: `Bonjour ${o.customerName.split(/\s+/)[0]}, le paiement de votre commande JAMAAL (${fcfa(o.total)}) n'a pas abouti. Vous pouvez réessayer, ou payer à la livraison si l'option est proposée. Répondez à ce message si besoin.`,
        ...(site ? { cta: { label: "Réessayer le paiement", url: `${site}/commande/${orderId}` } } : {}),
      });
    }
  });
}

/** Défis en cours : revendeur à 80 % de l'objectif ou plus (une fois par défi). Appelé par le cron. */
export async function alertChallengesAlmostDone(now = new Date()): Promise<number> {
  if (!(await on())) return 0;
  let sent = 0;
  for (const ch of await activeChallenges(now)) {
    for (const s of await challengeStandings(ch)) {
      if (s.reached || s.value < ch.target * 0.8) continue;
      if (!(await claimAutomation(`defi80:${ch.id}:${s.consultantId}`))) continue;
      const left = ch.target - s.value;
      const unit = METRIC_LABELS[ch.metric as ChallengeMetric] ?? "";
      notifyResellerWhatsApp(s.consultantId, `🔥 ${s.name.split(/\s+/)[0]}, plus que ${left.toLocaleString("fr-FR")} ${unit} pour réussir le défi « ${ch.title} » (bonus ${fcfa(ch.bonus)}) ! Fin le ${ch.endsAt.toLocaleDateString("fr-FR")}.`);
      sent++;
    }
  }
  return sent;
}
