/**
 * Alertes WhatsApp de l'équipe et des revendeurs (interrupteur « Alertes WhatsApp ») :
 * - revendeur : commission ou prime créditée, retrait versé, nouveau filleul, défi presque atteint ;
 * - équipe JAMAAL : avis négatif, paiement échoué.
 * Toujours en complément des notifications du back-office. Ne lève jamais d'erreur.
 */
import { messageText } from "./message-templates";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { automationEnabled, claimAutomation } from "@/lib/automation-settings";
import { activeChallenges, challengeStandings, METRIC_LABELS, type ChallengeMetric } from "@/lib/challenges";
import { getSiteUrl } from "@/lib/site-url";
import { notifyResellerWhatsApp, notifyTeamWhatsApp, sendWhatsApp } from "./index";
import { gainLine, gainsBehindWithdrawal, saleDetails } from "@/lib/sale-details";

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
export function alertWalletCredits(credits: { consultantId: string; amount: number; prime: boolean; level?: string; orderId?: string | null }[]) {
  if (!credits.length) return;
  later(async () => {
    if (!(await on())) return;
    const details = await saleDetails(credits.map((c) => c.orderId));
    const byOwner = new Map<string, typeof credits>();
    for (const c of credits) byOwner.set(c.consultantId, [...(byOwner.get(c.consultantId) ?? []), c]);
    for (const [id, list] of byOwner) {
      const total = list.reduce((s, c) => s + c.amount, 0);
      const lines = list.slice(0, 6).map((c) => `• ${gainLine({ amount: c.amount, level: c.level ?? (c.prime ? "PRIME_EQUIPE" : "VENTE") }, c.orderId ? details.get(c.orderId) : undefined, id)}`);
      notifyResellerWhatsApp(id, [`💰 +${fcfa(total)} crédités sur votre wallet JAMAAL :`, ...lines, ...(list.length > 6 ? [`… et ${list.length - 6} autre(s)`] : []), "Retrait possible vers Wave ou Orange Money depuis « Mon wallet »."].join("\n"));
    }
  });
}

/** Retrait versé (automatiquement ou à la main) : revendeur ou livreur, avec les ventes qui composent le montant. */
export function alertWithdrawalPaid(txId: string) {
  later(async () => {
    const t = await prisma.walletTransaction.findUnique({ where: { id: txId }, select: { id: true, amount: true, ownerType: true, ownerId: true, phone: true, provider: true, createdAt: true } });
    if (!t) return;
    const via = t.provider === "WAVE" ? "Wave" : t.provider === "ORANGE_MONEY" ? "Orange Money" : "votre compte";
    const compte = `${via}${t.phone ? ` (${t.phone})` : ""}`;
    const montant = fcfa(Math.abs(t.amount));
    const { lines, more } = await gainsBehindWithdrawal(t);
    const detail = lines.length ? ["Ce montant correspond à :", ...lines.map((l) => `• ${l}`), ...(more ? ["• … et vos gains précédents"] : [])].join("\n") : "";
    // Notification dans l'application (cloche), même si les alertes WhatsApp sont coupées.
    const user = await prisma.user.findFirst({ where: t.ownerType === "CONSULTANT" ? { consultantId: t.ownerId } : { livreurId: t.ownerId }, select: { id: true } });
    if (user) await prisma.notification.create({ data: { userId: user.id, title: `Retrait versé : ${montant}`, message: `${montant} envoyés sur ${compte}.${detail ? `\n${detail}` : ""}`.slice(0, 1500) } }).catch(() => {});
    if (!(await on())) return;
    const to =
      t.ownerType === "CONSULTANT"
        ? (await prisma.consultant.findUnique({ where: { id: t.ownerId }, select: { whatsapp: true } }))?.whatsapp
        : (await prisma.livreur.findUnique({ where: { id: t.ownerId }, select: { phone: true } }))?.phone;
    if (!to) return;
    const original = `✅ Retrait versé : ${montant} envoyés sur ${compte}.${detail ? `\n${detail}` : ""}\nMerci pour votre travail !`;
    let text = await messageText("retrait_verse", { montant, compte, detail }, original);
    // Message personnalisé sans {detail} : le détail des ventes est ajouté à la fin.
    if (detail && !text.includes(lines[0])) text = `${text}\n${detail}`;
    await sendWhatsApp({ to, kind: "reseller", text });
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
        text: await messageText(
          "paiement_echoue",
          { prenom: o.customerName.split(/\s+/)[0], montant: fcfa(o.total) },
          `Bonjour ${o.customerName.split(/\s+/)[0]}, le paiement de votre commande JAMAAL (${fcfa(o.total)}) n'a pas abouti. Vous pouvez réessayer, ou payer à la livraison si l'option est proposée. Répondez à ce message si besoin.`
        ),
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
