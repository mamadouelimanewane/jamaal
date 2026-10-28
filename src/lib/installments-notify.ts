/**
 * Paiement en plusieurs fois : messages WhatsApp au client (échéance reçue, rappels avant et le jour
 * de l'échéance), alerte au revendeur et à l'équipe en cas de retard. Chaque rappel est unique (AutomationSent).
 */
import { prisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/site-url";
import { automationEnabled, claimAutomation } from "@/lib/automation-settings";
import { phoneOptedOut } from "@/lib/phone-match";
import { sendWhatsApp } from "@/lib/whatsapp";
import { nextInstallment, receivedText, reminderText, fcfa, splitAmounts } from "@/lib/installments";

const DAY = 86_400_000;
const ref = (id: string) => id.slice(-8).toUpperCase();
const first = (n: string) => n.trim().split(/\s+/)[0] || "";
const select = { id: true, customerName: true, customerPhone: true, total: true, createdAt: true, installmentCount: true, installmentsPaid: true, installmentIntervalDays: true, consultantId: true } as const;

async function toClient(to: string | null, text: string, url: string) {
  if (!to || !(await automationEnabled("orderTracking")) || (await phoneOptedOut(to))) return;
  await sendWhatsApp({ to, kind: "suivi", text, cta: { label: "Payer mon échéance", url } });
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
    await toClient(o.customerPhone, receivedText({ firstName: first(o.customerName), n, of: o.installmentCount, amount, next, ref: ref(o.id) }), `${site}/commande/${o.id}`);
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
      await toClient(o.customerPhone, reminderText({ firstName: first(o.customerName), n: next.n, of: next.of, amount: next.amount, dueAt: next.dueAt, today, ref: ref(o.id) }), url);
    }
  }
  return { suivies: orders.length, rappels, retards };
}
