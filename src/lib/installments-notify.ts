/**
 * Paiement en plusieurs fois : messages WhatsApp au client (échéance reçue, rappels avant et le jour
 * de l'échéance), alerte au revendeur et à l'équipe en cas de retard. Chaque rappel est unique (AutomationSent).
 */
import { prisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/site-url";
import { automationEnabled, claimAutomation } from "@/lib/automation-settings";
import { phoneOptedOut } from "@/lib/phone-match";
import { sendWhatsApp } from "@/lib/whatsapp";
import { nextInstallment, receivedText, receivedVars, reminderText, reminderVars, fcfa, splitAmounts } from "@/lib/installments";
import { messageText } from "@/lib/whatsapp/message-templates";

const DAY = 86_400_000;
const ref = (id: string) => id.slice(-8).toUpperCase();
const first = (n: string) => n.trim().split(/\s+/)[0] || "";
const select = { id: true, customerName: true, customerPhone: true, total: true, createdAt: true, installmentCount: true, installmentsPaid: true, installmentIntervalDays: true, consultantId: true } as const;

async function toClient(to: string | null, text: string, url: string, label = "Payer mon échéance") {
  if (!to || !(await automationEnabled("orderTracking")) || (await phoneOptedOut(to))) return;
  await sendWhatsApp({ to, kind: "suivi", text, cta: { label, url } });
}

async function toReseller(consultantId: string | null, orderId: string, title: string, message: string) {
  if (!consultantId) return;
  const user = await prisma.user.findFirst({ where: { consultantId }, select: { id: true } });
  if (user) await prisma.notification.create({ data: { userId: user.id, orderId, title, message } });
}

/** Échéance intermédiaire reçue : confirmation au client, information au revendeur. */
export async function notifyInstallmentReceived(orderId: string, n: number) {
  try {
    const o = await prisma.order.findUnique({ where: { id: orderId }, select });
    if (!o) return;
    const site = (await getSiteUrl().catch(() => "")).replace(/\/$/, "");
    const amount = o.installmentCount ? splitAmounts(o.total, o.installmentCount)[n - 1] : 0;
    const next = nextInstallment(o);
    const ri = { firstName: first(o.customerName), n, of: o.installmentCount, amount, next, ref: ref(o.id) };
    await toClient(o.customerPhone, await messageText("echeance_recue", receivedVars(ri), receivedText(ri)), `${site}/commande/${o.id}`);
    await toReseller(o.consultantId, o.id, `Échéance ${n}/${o.installmentCount} reçue`, `${o.customerName} a réglé ${fcfa(amount)} (commande n° ${ref(o.id)}).${next ? ` Prochaine échéance le ${next.dueAt.toLocaleDateString("fr-FR")}.` : ""}`);
  } catch (e) {
    console.error("[échéances] confirmation", orderId, e);
  }
}

/**
 * Tâche quotidienne : rappel 2 jours avant et le jour de chaque échéance ; à 7 jours de retard,
 * alerte au revendeur et à l'équipe (la commande reste en attente, rien n'est annulé automatiquement).
 */
export async function runInstallmentReminders(now = new Date()) {
  const orders = await prisma.order.findMany({
    where: { installmentCount: { gte: 2 }, paymentStatus: { not: "PAYE" }, status: { not: "ANNULEE" }, installmentsPaid: { gte: 1 }, installmentNextDue: { lte: new Date(now.getTime() + 2 * DAY) } },
    select,
    take: 200,
  });
  const site = (await getSiteUrl().catch(() => "")).replace(/\/$/, "");
  let rappels = 0, retards = 0;
  for (const o of orders) {
    const next = nextInstallment(o);
    if (!next) continue;
    const late = Math.floor((now.getTime() - next.dueAt.getTime()) / DAY);
    const url = `${site}/commande/${o.id}`;
    if (late >= 7) {
      if (await claimAutomation(`echeance:${o.id}:${next.n}:retard`)) {
        retards++;
        const msg = `${o.customerName} a ${late} jours de retard sur l'échéance ${next.n}/${next.of} (${fcfa(next.amount)}) de la commande n° ${ref(o.id)}.`;
        await toReseller(o.consultantId, o.id, "Échéance en retard", `${msg} Relancez votre client.`);
        const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true }, take: 20 });
        if (admins.length) await prisma.notification.createMany({ data: admins.map((a) => ({ userId: a.id, orderId: o.id, title: "Échéance en retard", message: msg })) });
      }
      continue;
    }
    const today = late >= 0;
    const key = `echeance:${o.id}:${next.n}:${today ? "jour" : "avant"}`;
    if (await claimAutomation(key)) {
      rappels++;
      const rv = { firstName: first(o.customerName), n: next.n, of: next.of, amount: next.amount, dueAt: next.dueAt, today, ref: ref(o.id) };
      await toClient(o.customerPhone, await messageText("echeance_rappel", reminderVars(rv), reminderText(rv)), url);
    }
  }
  return { suivies: orders.length, rappels, retards };
}

/** Lien de paiement jamais payé : relance à 2 jours, annulation (stock remis en vente) à 7 jours. */
export const UNPAID_REMIND_DAYS = 2;
export const UNPAID_CANCEL_DAYS = 7;

/**
 * Tâche quotidienne : commandes d'un revendeur à payer en ligne, et commandes en plusieurs fois,
 * dont rien n'a été payé. Le paiement est d'abord vérifié auprès du prestataire (jamais d'annulation
 * d'une commande payée dont la confirmation serait en retard). Les commandes déjà en partie payées
 * ne sont jamais annulées automatiquement.
 */
export async function runUnpaidPaymentLinks(now = new Date()) {
  const orders = await prisma.order.findMany({
    where: {
      paymentStatus: { not: "PAYE" },
      status: { notIn: ["ANNULEE", "LIVREE"] },
      installmentsPaid: 0,
      isReservation: false,
      createdAt: { lte: new Date(now.getTime() - UNPAID_REMIND_DAYS * DAY) },
      OR: [{ channel: "REVENDEUR", paymentMethod: { in: ["WAVE", "ORANGE_MONEY", "STRIPE"] } }, { installmentCount: { gte: 2 } }],
    },
    select: { ...select, paymentRef: true },
    take: 100,
  });
  const site = (await getSiteUrl().catch(() => "")).replace(/\/$/, "");
  const { settlePendingPayment } = await import("@/lib/payment/settle");
  const { setOrderStatus } = await import("@/lib/orders/status");
  let relances = 0, annulees = 0, payees = 0;
  for (const o of orders) {
    if ((await settlePendingPayment(o.id).catch(() => "unknown")) === "paid") {
      payees++;
      continue;
    }
    const age = Math.floor((now.getTime() - o.createdAt.getTime()) / DAY);
    const url = `${site}/commande/${o.id}`;
    if (age >= UNPAID_CANCEL_DAYS) {
      if (!(await claimAutomation(`lien:${o.id}:annulation`))) continue;
      await setOrderStatus(o.id, "ANNULEE");
      annulees++;
      await toReseller(o.consultantId, o.id, "Commande annulée faute de paiement", `La commande n° ${ref(o.id)} de ${o.customerName} (${fcfa(o.total)}) n'a pas été payée en ${UNPAID_CANCEL_DAYS} jours : elle est annulée et les produits sont remis en stock. Vous pouvez la refaire à tout moment.`);
    } else if (await claimAutomation(`lien:${o.id}:relance`)) {
      relances++;
      const uv = { firstName: first(o.customerName), total: o.total, ref: ref(o.id), days: UNPAID_CANCEL_DAYS - age };
      await toClient(o.customerPhone, await messageText("commande_a_payer", { prenom: uv.firstName, numero: uv.ref, montant: fcfa(uv.total), delai: `${uv.days} jour${uv.days > 1 ? "s" : ""}` }, unpaidReminderText(uv)), url, "Payer ma commande");
      await toReseller(o.consultantId, o.id, "Commande pas encore payée", `${o.customerName} n'a pas encore payé la commande n° ${ref(o.id)} (${fcfa(o.total)}). Un rappel lui a été envoyé ; sans paiement, elle sera annulée dans ${UNPAID_CANCEL_DAYS - age} jour(s).`);
    }
  }
  return { suivies: orders.length, relances, annulees, payees };
}

/** Rappel au client d'une commande préparée par son conseiller et pas encore payée. */
export function unpaidReminderText(o: { firstName: string; total: number; ref: string; days: number }): string {
  return `Bonjour${o.firstName ? ` ${o.firstName}` : ""} 🌸\nVotre commande JAMAAL n° ${o.ref} (${fcfa(o.total)}) vous attend. Réglez-la en un clic avec Wave ou Orange Money grâce au bouton ci-dessous : elle est préparée dès réception.\nSans paiement d'ici ${o.days} jour${o.days > 1 ? "s" : ""}, elle sera annulée.`;
}
