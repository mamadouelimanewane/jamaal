/**
 * Abonnements de réassort (serveur) : création depuis une commande, rappel 3 jours avant, commande
 * automatique à l'échéance (prix du jour, remise abonné, même livraison), paiement en un clic sur WhatsApp.
 */
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { placeOrder } from "@/lib/orders/place-order";
import { sendWhatsApp, notifyTeamWhatsApp } from "@/lib/whatsapp";
import { messageText } from "@/lib/whatsapp/message-templates";
import { phoneOptedOut } from "@/lib/phone-match";
import { addDays, DEFAULT_DISCOUNT_PCT, isDue, itemsLabel, needsReminder, parseSubDelivery, parseSubItems, repriceItems, REMIND_DAYS_BEFORE, validInterval, type SubItem } from "./plan";

const SETTING_KEY = "abonnement_remise_pct";

export async function subscriptionDiscountPct(): Promise<number> {
  const row = await prisma.setting.findUnique({ where: { key: SETTING_KEY } }).catch(() => null);
  const n = Number(row?.value);
  return Number.isFinite(n) && n >= 0 && n <= 30 ? Math.round(n) : DEFAULT_DISCOUNT_PCT;
}
export async function setSubscriptionDiscountPct(pct: number) {
  const value = String(Math.max(0, Math.min(30, Math.round(pct))));
  await prisma.setting.upsert({ where: { key: SETTING_KEY }, create: { key: SETTING_KEY, value }, update: { value } });
}

export const newToken = () => randomBytes(18).toString("base64url");

/** Abonnement créé à partir d'une commande (mêmes produits, même livraison). Un seul abonnement actif par commande. */
export async function createSubscriptionFromOrder(orderId: string, intervalDays: unknown) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, customerName: true, customerPhone: true, customerEmail: true, consultantId: true, address: true, deliveryMode: true, deliveryLat: true, deliveryLng: true, deliveryPlace: true, isReservation: true, status: true, subscriptionId: true, items: { select: { productId: true, productName: true, volumeLabel: true, quantity: true } } },
  });
  if (!order || order.isReservation || order.status === "ANNULEE") throw new Error("Cette commande ne peut pas devenir un abonnement.");
  if (!order.customerPhone) throw new Error("Un numéro WhatsApp est nécessaire pour l'abonnement.");
  const existing = await prisma.subscription.findFirst({ where: { OR: [{ sourceOrderId: order.id }, ...(order.subscriptionId ? [{ id: order.subscriptionId }] : [])], status: { not: "ANNULE" } } });
  if (existing) return existing;
  const items: SubItem[] = parseSubItems(order.items.filter((i) => i.productId));
  if (!items.length) throw new Error("Aucun produit à renouveler.");
  const days = validInterval(intervalDays);
  const delivery =
    order.deliveryMode === "LIVRAISON_JAMAAL" && order.deliveryLat != null && order.deliveryLng != null
      ? { mode: "LIVRAISON", lat: order.deliveryLat, lng: order.deliveryLng, address: order.address, place: order.deliveryPlace }
      : { mode: "RETRAIT" };
  const sub = await prisma.subscription.create({
    data: {
      token: newToken(),
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerEmail: order.customerEmail,
      consultantId: order.consultantId,
      items,
      intervalDays: days,
      discountPct: await subscriptionDiscountPct(),
      delivery,
      nextRunAt: addDays(new Date(), days),
      sourceOrderId: order.id,
    },
  });
  notifyTeamWhatsApp(`🔁 Nouvel abonnement de réassort : ${order.customerName}, ${itemsLabel(items)}, tous les ${days} jours.`);
  return sub;
}

/** Crée la commande de l'échéance. Renvoie l'id de la commande, ou lève une erreur lisible. */
export async function runSubscriptionOrder(subId: string, now = new Date()): Promise<string> {
  const sub = await prisma.subscription.findUnique({ where: { id: subId } });
  if (!sub || sub.status === "ANNULE") throw new Error("Abonnement introuvable.");
  const items = parseSubItems(sub.items);
  const products = await prisma.product.findMany({ where: { id: { in: items.map((i) => i.productId) } }, select: { id: true, name: true, volumes: true, regularPrice: true } });
  const { priced, missing } = repriceItems(items, products);
  if (!priced.length) throw new Error(`Produits indisponibles : ${missing.join(", ")}.`);
  const delivery = parseSubDelivery(sub.delivery);
  const id = await placeOrder(
    { name: sub.customerName, phone: sub.customerPhone, email: sub.customerEmail ?? undefined, address: delivery.address ?? undefined },
    priced.map((i) => ({ productId: i.productId, productName: i.productName, volumeLabel: i.volumeLabel, price: i.price, quantity: i.quantity })),
    sub.consultantId,
    true,
    false,
    "",
    delivery.mode === "LIVRAISON" ? { mode: "LIVRAISON", lat: delivery.lat, lng: delivery.lng, place: delivery.place } : { mode: "RETRAIT" },
    false,
    { rateKey: `abonnement:${sub.id}`, channel: "Abonnement", source: "SITE", subscriptionId: sub.id, subscriptionDiscountPct: sub.discountPct }
  );
  await prisma.subscription.update({
    where: { id: sub.id },
    data: { lastOrderId: id, ordersCount: { increment: 1 }, nextRunAt: addDays(now, sub.intervalDays), remindedAt: null },
  });
  if (missing.length) notifyTeamWhatsApp(`Abonnement de ${sub.customerName} : ${missing.join(", ")} n'existe plus, retiré de la commande ${id.slice(-8).toUpperCase()}.`);
  return id;
}

/** Tâche quotidienne : rappels puis commandes des abonnements arrivés à échéance. */
export async function runSubscriptions(origin: string, now = new Date()) {
  const subs = await prisma.subscription.findMany({ where: { status: "ACTIVE", nextRunAt: { lte: addDays(now, REMIND_DAYS_BEFORE) } }, orderBy: { nextRunAt: "asc" }, take: 200 });
  let rappels = 0;
  let commandes = 0;
  const erreurs: string[] = [];
  const site = origin.replace(/\/$/, "");
  for (const s of subs) {
    try {
      if (isDue(s, now)) {
        // Commande précédente toujours impayée : on ne cumule pas, on décale d'une semaine.
        if (s.lastOrderId) {
          const last = await prisma.order.findUnique({ where: { id: s.lastOrderId }, select: { paymentStatus: true, status: true, paymentMethod: true } });
          if (last && last.status !== "ANNULEE" && last.paymentStatus !== "PAYE" && last.paymentMethod !== "A_LA_LIVRAISON") {
            await prisma.subscription.update({ where: { id: s.id }, data: { nextRunAt: addDays(now, 7) } });
            erreurs.push(`${s.customerName} : commande précédente impayée, décalé d'une semaine`);
            continue;
          }
        }
        await runSubscriptionOrder(s.id, now);
        commandes++;
      } else if (needsReminder(s, now)) {
        await prisma.subscription.update({ where: { id: s.id }, data: { remindedAt: now } });
        if (await phoneOptedOut(s.customerPhone)) continue;
        const items = parseSubItems(s.items);
        const days = Math.max(1, Math.ceil((s.nextRunAt.getTime() - now.getTime()) / 86_400_000));
        const vars = { prenom: s.customerName.split(/\s+/)[0] || s.customerName, articles: itemsLabel(items), jours: String(days), lien: `${site}/abonnement/${s.token}` };
        const original = `Bonjour ${vars.prenom} 🌸 Votre réassort JAMAAL (${vars.articles}) sera préparé dans ${days} jours. Rien à faire ! Pour décaler, changer ou mettre en pause : ${vars.lien}`;
        await sendWhatsApp({ to: s.customerPhone, kind: "relance", text: await messageText("abonnement_rappel", vars, original), cta: { label: "Gérer mon abonnement", url: vars.lien } });
        rappels++;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      erreurs.push(`${s.customerName} : ${msg}`);
      await prisma.subscription.update({ where: { id: s.id }, data: { nextRunAt: addDays(now, 1) } }).catch(() => {});
    }
  }
  if (erreurs.length) notifyTeamWhatsApp(`Abonnements : ${erreurs.slice(0, 5).join(" ; ")}`);
  return { rappels, commandes, erreurs: erreurs.length };
}
