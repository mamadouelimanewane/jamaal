/**
 * Relances automatiques des clients sur WhatsApp (tâche quotidienne) :
 * - rappel « bientôt fini ? » 45 jours après un achat (sauf s'il a recommandé depuis) ;
 * - anniversaire : message et code cadeau de 10 % valable 15 jours ;
 * - panier commencé sans commande (3 à 48 h) : rappel avec reprise possible sur WhatsApp.
 * Jamais pour un client qui a répondu STOP, ni pour les clients d'un revendeur qui a coupé les
 * relances. Chaque envoi est unique (clé AutomationSent).
 */
import { randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { ordersByPhoneSince, phoneOptedOut } from "@/lib/phone-match";
import { sendWhatsApp, whatsappConfig } from "@/lib/whatsapp";
import { automationEnabled, claimAutomation } from "@/lib/automation-settings";

const DAY = 86_400_000;
const MAX_PER_RUN = 80;
const STOP = "\n\n(Répondez STOP pour ne plus recevoir ces messages.)";
const firstName = (name: string | null | undefined) => (name ?? "").trim().split(/\s+/)[0] || "";

export function relance45Text(o: { firstName: string; product: string; link: string; reseller: string | null }): string {
  return `Bonjour${o.firstName ? ` ${o.firstName}` : ""} 🌸\nCela fait environ 45 jours que vous avez pris *${o.product}*. Votre flacon est bientôt fini ?\nOn vous le prépare : ${o.link}\nOu répondez simplement à ce message pour commander.${o.reseller ? `\n${o.reseller}, votre conseiller·e JAMAAL` : "\nL'équipe JAMAAL"}${STOP}`;
}

export function birthdayText(o: { firstName: string; code: string; days: number; origin: string }): string {
  return `Joyeux anniversaire${o.firstName ? ` ${o.firstName}` : ""} ! 🎂✨\nToute l'équipe JAMAAL vous souhaite une très belle journée.\nPour l'occasion : *-10 %* sur votre prochaine commande avec le code *${o.code}* (valable ${o.days} jours) : ${o.origin}/collections${STOP}`;
}

export function cartText(o: { firstName: string; items: string[]; origin: string }): string {
  return `Bonjour${o.firstName ? ` ${o.firstName}` : ""} 👋\nVotre panier JAMAAL vous attend : ${o.items.slice(0, 3).join(", ")}${o.items.length > 3 ? "…" : ""}.\nFinalisez ici : ${o.origin}/panier\nOu répondez à ce message : on prend votre commande directement sur WhatsApp.${STOP}`;
}

const optedOut = phoneOptedOut;

async function reminder45(origin: string, now: Date, budget: { left: number }): Promise<number> {
  const orders = await prisma.order.findMany({
    where: { status: { not: "ANNULEE" }, customerPhone: { not: null }, createdAt: { gte: new Date(now.getTime() - 46 * DAY), lt: new Date(now.getTime() - 45 * DAY) } },
    select: {
      id: true, customerName: true, customerPhone: true, createdAt: true,
      consultant: { select: { name: true, slug: true, autoRelances: true, active: true } },
      items: { select: { productName: true, product: { select: { slug: true } } }, take: 1 },
    },
    take: 300,
  });
  let sent = 0;
  for (const o of orders) {
    if (budget.left <= 0) break;
    const phone = o.customerPhone!;
    if (o.consultant && !o.consultant.autoRelances) continue;
    const item = o.items[0];
    if (!item) continue;
    const newer = await ordersByPhoneSince(phone, o.createdAt);
    if (newer || (await optedOut(phone))) continue;
    if (!(await claimAutomation(`relance45:${o.id}`))) continue;
    const ref = o.consultant?.active && o.consultant.slug ? `?ref=${o.consultant.slug}` : "";
    const link = item.product?.slug ? `${origin}/produits/${item.product.slug}${ref}` : `${origin}/collections${ref}`;
    await sendWhatsApp({ to: phone, kind: "relance", text: relance45Text({ firstName: firstName(o.customerName), product: item.productName, link, reseller: o.consultant?.active ? o.consultant.name : null }) });
    budget.left--;
    sent++;
  }
  return sent;
}

async function birthdays(origin: string, now: Date, budget: { left: number }): Promise<number> {
  const mmdd = `${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
  const customers = await prisma.customer.findMany({ where: { birthday: mmdd, whatsappOptOut: false }, select: { id: true, name: true, phone: true }, take: 200 });
  let sent = 0;
  for (const c of customers) {
    if (budget.left <= 0) break;
    const last = await prisma.order.findFirst({ where: { customerId: c.id }, orderBy: { createdAt: "desc" }, select: { consultant: { select: { autoRelances: true } } } });
    if (last?.consultant && !last.consultant.autoRelances) continue;
    if (!(await claimAutomation(`anniversaire:${c.id}:${now.getUTCFullYear()}`))) continue;
    const code = `ANNIV-${randomInt(1000, 9999)}${c.id.slice(-2).toUpperCase()}`;
    await prisma.coupon.create({ data: { code, type: "POURCENTAGE", value: 10, usageLimit: 1, expiresAt: new Date(now.getTime() + 15 * DAY) } });
    await sendWhatsApp({ to: c.phone, kind: "relance", text: birthdayText({ firstName: firstName(c.name), code, days: 15, origin }) });
    budget.left--;
    sent++;
  }
  return sent;
}

async function abandonedCarts(origin: string, now: Date, budget: { left: number }): Promise<number> {
  const carts = await prisma.abandonedCart.findMany({
    where: { orderedAt: null, remindedAt: null, updatedAt: { gte: new Date(now.getTime() - 2 * DAY), lt: new Date(now.getTime() - 3 * 3_600_000) } },
    orderBy: { updatedAt: "asc" },
    take: 100,
  });
  let sent = 0;
  for (const cart of carts) {
    if (budget.left <= 0) break;
    const ordered = await ordersByPhoneSince(cart.phone, new Date(cart.createdAt.getTime() - 1));
    if (ordered) {
      await prisma.abandonedCart.update({ where: { id: cart.id }, data: { orderedAt: now } });
      continue;
    }
    if (await optedOut(cart.phone)) continue;
    if (cart.consultantId) {
      const c = await prisma.consultant.findUnique({ where: { id: cart.consultantId }, select: { autoRelances: true } });
      if (c && !c.autoRelances) continue;
    }
    if (!(await claimAutomation(`panier:${cart.id}`))) continue;
    const items = ((cart.items as { name?: string; volumeLabel?: string }[] | null) ?? []).map((i) => `${i.name ?? "article"}${i.volumeLabel ? ` (${i.volumeLabel})` : ""}`);
    await sendWhatsApp({ to: cart.phone, kind: "relance", text: cartText({ firstName: firstName(cart.name), items, origin }) });
    await prisma.abandonedCart.update({ where: { id: cart.id }, data: { remindedAt: now } });
    budget.left--;
    sent++;
  }
  return sent;
}

export async function runRelances(origin: string, now = new Date()) {
  // Sans envoi WhatsApp configuré, on n'« use » pas les relances (elles partiront une fois configuré).
  if (!whatsappConfig().active) return "WhatsApp non configuré : aucune relance envoyée";
  const budget = { left: MAX_PER_RUN };
  const [on45, onBirthday, onCart] = await Promise.all([automationEnabled("relance45"), automationEnabled("birthday"), automationEnabled("cart")]);
  return {
    rappels45j: on45 ? await reminder45(origin, now, budget) : "désactivé",
    anniversaires: onBirthday ? await birthdays(origin, now, budget) : "désactivé",
    paniers: onCart ? await abandonedCarts(origin, now, budget) : "désactivé",
  };
}
