"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireLivreurProfile } from "./auth-guard";
import { OrderStatus } from "@prisma/client";
import { upsertCustomerFromOrder } from "@/lib/customers";
import { notifyConsultantOfDelivery } from "@/lib/notifications";
import { notifySponsorOnSale } from "@/lib/sponsor-notifications";
import { cancelCommissionsForOrder, runPayoutsForOrder } from "@/lib/payouts/engine";
import { recordLivreurEarning } from "@/lib/delivery-engine";
import { after } from "next/server";
import { notifyResellerWhatsApp, notifyTeamWhatsApp } from "@/lib/whatsapp";
import { reserveStock, resolveStockRef, sendLowStockAlerts, syncOrderStock, UNIQUE_FORMAT } from "@/lib/stock";
import { createOrderSchema } from "@/lib/validations/order";
import { rateLimit, clientIpFromHeaders } from "@/lib/rate-limit";
import { getBusinessModel } from "@/lib/business-model-store";
import { isValidPoint, newDeliveryCode, quoteDelivery } from "@/lib/delivery";
import { depositFor } from "@/lib/reservation";
import { getReservationSettings } from "@/lib/reservation-store";

export interface CheckoutItem {
  productId: string;
  productName: string;
  volumeLabel: string;
  price: number;
  quantity: number;
}

/** Mode de remise choisi au panier. */
export interface CheckoutDelivery {
  mode: "LIVRAISON" | "RETRAIT";
  lat?: number | null;
  lng?: number | null;
  /** Position estimée à partir d'une adresse floue. */
  approx?: boolean;
  /** Lieu trouvé par la recherche d'adresse. */
  place?: string | null;
  /** Destinataire, quand le colis est pour quelqu'un d'autre. */
  recipientName?: string | null;
  recipientPhone?: string | null;
}

export interface CheckoutCustomer {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

/**
 * Crée une commande publique (checkout client).
 * - Rate limit (5 commandes / min / IP)
 * - Valide les données avec Zod
 * - Recalcule les prix et le total côté serveur
 * - Vérifie le stock avant création
 * - Attache le consultant (ref cookie ou choix manuel)
 */
export type CreateOrderResult = { ok: true; id: string } | { ok: false; error: string };

/**
 * Passe la commande du panier. Renvoie le message d'erreur au lieu de le lever : en production,
 * Next.js masque les messages des erreurs levées par une action serveur (le client ne verrait
 * qu'un code d'erreur au lieu de « stock insuffisant », « prix modifié »…).
 */
/**
 * Réservation d'un format en rupture : même parcours qu'une commande (prix, livraison, client),
 * sans prise de stock ; le client paie un acompte, le solde à l'arrivée du produit.
 */
export async function createReservation(
  customer: CheckoutCustomer,
  item: CheckoutItem,
  consultantId: string | null,
  acceptCgv: boolean,
  delivery: CheckoutDelivery
): Promise<CreateOrderResult> {
  return createOrder(customer, [item], consultantId, acceptCgv, false, "", delivery, true);
}

export async function createOrder(...args: Parameters<typeof placeOrder>): Promise<CreateOrderResult> {
  try {
    return { ok: true, id: await placeOrder(...args) };
  } catch (e) {
    const internal = !(e instanceof Error) || /^PrismaClient/.test(e.constructor.name);
    if (internal) console.error("[commande]", e);
    return { ok: false, error: internal ? "Une erreur est survenue, merci de réessayer." : e.message };
  }
}

async function placeOrder(
  customer: CheckoutCustomer,
  items: CheckoutItem[],
  consultantId?: string | null,
  acceptCgv: boolean = false,
  giftWrap: boolean = false,
  giftMessage: string = "",
  delivery: CheckoutDelivery = { mode: "RETRAIT" },
  reservation: boolean = false
) {
  // 0. Rate limiting
  const h = await headers();
  const ip = clientIpFromHeaders(h);
  const limited = await rateLimit(`order:${ip}`, { limit: 5, windowMs: 60_000 });
  if (!limited.ok) {
    throw new Error(
      `Trop de tentatives. Réessayez dans ${limited.retryAfterSec} seconde(s).`
    );
  }

  // 1. Validation structurelle
  const parsed = createOrderSchema.safeParse({
    customer: {
      name: customer.name ?? "",
      phone: customer.phone ?? "",
      email: customer.email ?? "",
      address: customer.address ?? "",
    },
    items,
    consultantId: consultantId || null,
    acceptCgv: acceptCgv === true ? true : false,
    giftWrap: giftWrap === true,
    giftMessage: giftMessage.trim(),
  });

  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new Error(first?.message ?? "Données de commande invalides");
  }

  const data = parsed.data;

  // 2. Charger les produits réels et vérifier le stock
  const productIds = [...new Set(data.items.map((i) => i.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      name: true,
      stock: true,
      volumes: true,
      regularPrice: true,
      testerPrice: true,
    },
  });

  if (products.length !== productIds.length) {
    throw new Error("Un ou plusieurs produits n'existent plus. Merci de rafraîchir votre panier.");
  }

  const productMap = new Map(products.map((p) => [p.id, p]));

  // 3. Recalculer prix + vérifier stock (jamais faire confiance au client)
  const serverItems: CheckoutItem[] = [];
  let total = 0;

  for (const item of data.items) {
    const product = productMap.get(item.productId)!;

    // Le stock (par format) est contrôlé et retiré dans la transaction de création, plus bas.
    // Prix serveur : on accepte le prix client s'il correspond à un volume connu,
    // sinon on refuse (évite la manipulation).
    const volumes = (product.volumes as { label: string; price: number }[] | null) ?? [];
    // Ancien panier (« Format unique » au prix du format principal) : rattaché au format principal.
    if (volumes.length && item.volumeLabel === UNIQUE_FORMAT && item.price === product.regularPrice) {
      const main = volumes.find((v) => v.price === product.regularPrice) ?? volumes[0];
      item.volumeLabel = main.label;
    }
    const matchedVolume = volumes.find(
      (v) => v.label === item.volumeLabel && v.price === item.price
    );
    const isTester =
      product.testerPrice != null &&
      item.volumeLabel.toLowerCase().includes("échantillon") &&
      item.price === product.testerPrice;
    // Prix « régulier » : uniquement pour un produit sans volumes définis
    const isRegular =
      !volumes.length &&
      product.regularPrice != null &&
      item.price === product.regularPrice;

    if (!matchedVolume && !isTester && !isRegular) {
      throw new Error(
        `Prix incohérent pour « ${product.name} » (${item.volumeLabel}). Merci de rafraîchir votre panier.`
      );
    }

    const lineTotal = item.price * item.quantity;
    total += lineTotal;

    serverItems.push({
      productId: item.productId,
      productName: product.name, // nom serveur (source de vérité)
      volumeLabel: item.volumeLabel,
      price: item.price,
      quantity: item.quantity,
    });
  }

  // 3 ter. Réservation : un seul article, réellement en rupture ; acompte sur le prix des produits.
  let reservationData: {
    isReservation?: boolean;
    depositAmount?: number;
    reservationStatus?: string;
    reservationDelay?: string;
    stockState?: string;
  } = {};
  if (reservation) {
    const settings = await getReservationSettings();
    if (!settings.enabled) throw new Error("La réservation n'est pas proposée pour le moment.");
    if (serverItems.length !== 1) throw new Error("Une réservation porte sur un seul produit.");
    const it = serverItems[0];
    if (it.quantity < 1 || it.quantity > 20) throw new Error("Quantité invalide (20 au maximum).");
    const ref = await resolveStockRef(prisma, it.productId, it.volumeLabel);
    const available = ref ? (ref.variantId ? (await prisma.productVariant.findUnique({ where: { id: ref.variantId }, select: { stock: true } }))?.stock : (await prisma.product.findUnique({ where: { id: it.productId }, select: { stock: true } }))?.stock) ?? 0 : 0;
    if (available > 0) throw new Error("Ce format est de nouveau disponible : ajoutez-le directement au panier.");
    reservationData = {
      isReservation: true,
      depositAmount: depositFor(total, settings.depositPercent),
      reservationStatus: "ACOMPTE_ATTENDU",
      reservationDelay: settings.delayLabel,
      stockState: "ATTENTE",
    };
  }

  // 3 bis. Livraison : frais recalculés côté serveur à partir de la position du client.
  const productsTotal = total;
  let deliveryData: {
    deliveryMode: "LIVRAISON_JAMAAL" | "RETRAIT_CONSULTANT";
    deliveryLat?: number;
    deliveryLng?: number;
    deliveryFee?: number;
    deliveryDistanceKm?: number;
    deliveryCode?: string;
    deliveryStatus?: string;
    livreurShare?: number;
    deliveryApprox?: boolean;
    deliveryPlace?: string | null;
    deliveryContactName?: string | null;
    deliveryContactPhone?: string | null;
  } = { deliveryMode: "RETRAIT_CONSULTANT" };
  if (delivery?.mode === "LIVRAISON") {
    const point = { lat: Number(delivery.lat), lng: Number(delivery.lng) };
    if (!isValidPoint(point)) throw new Error("Indiquez votre position de livraison sur la carte.");
    if (!data.customer.address) throw new Error("Précisez votre adresse de livraison (quartier, repère).");
    const quote = quoteDelivery(point, productsTotal, await getBusinessModel());
    if (!quote.ok) throw new Error(quote.error);
    const recipientName = String(delivery.recipientName ?? "").trim().slice(0, 80);
    const recipientPhone = String(delivery.recipientPhone ?? "").trim().slice(0, 30);
    if (recipientName || recipientPhone) {
      if (!recipientName) throw new Error("Indiquez le nom de la personne qui reçoit le colis.");
      if (recipientPhone.replace(/\D/g, "").length < 8 || !/^[+\d\s().-]+$/.test(recipientPhone)) throw new Error("Numéro du destinataire invalide.");
    }
    total += quote.fee;
    deliveryData = {
      deliveryMode: "LIVRAISON_JAMAAL",
      deliveryLat: point.lat,
      deliveryLng: point.lng,
      deliveryFee: quote.fee,
      deliveryDistanceKm: quote.distanceKm,
      deliveryCode: newDeliveryCode(),
      // Réservation : la livraison démarre à l'arrivée du produit.
      deliveryStatus: reservation ? undefined : "A_PREPARER",
      livreurShare: quote.livreurShare,
      deliveryApprox: delivery.approx === true,
      deliveryPlace: String(delivery.place ?? "").trim().slice(0, 120) || null,
      deliveryContactName: recipientName || null,
      deliveryContactPhone: recipientPhone || null,
    };
  }

  // 4. Vérifier le consultant s'il est fourni
  let validConsultantId: string | null = null;
  if (data.consultantId) {
    const consultant = await prisma.consultant.findFirst({
      where: { id: data.consultantId, active: true },
      select: { id: true },
    });
    if (!consultant) {
      throw new Error("Le consultant sélectionné n'est plus disponible.");
    }
    validConsultantId = consultant.id;
  }

  // 5. Upsert client
  const customerId = data.customer.phone
    ? await upsertCustomerFromOrder({
        name: data.customer.name,
        phone: data.customer.phone,
        email: data.customer.email || null,
        address: data.customer.address || null,
      })
    : null;

  // 6. Commande + réservation du stock dans une même transaction (anti-survente)
  const { order, stockAlerts } = await prisma.$transaction(async (tx) => {
  const variantIds = await Promise.all(serverItems.map(async (i) => (await resolveStockRef(tx, i.productId, i.volumeLabel))?.variantId ?? null));
  const order = await tx.order.create({
    data: {
      customerName: data.customer.name,
      customerEmail: data.customer.email || null,
      customerPhone: data.customer.phone || null,
      address: data.customer.address || null,
      total,
      giftWrap: data.giftWrap,
      giftMessage: data.giftWrap ? (data.giftMessage || null) : null,
      customerId,
      consultantId: validConsultantId,
      ...deliveryData,
      ...reservationData,
      items: {
        create: serverItems.map((i, k) => ({
          productId: i.productId,
          variantId: variantIds[k],
          productName: i.productName,
          volumeLabel: i.volumeLabel,
          price: i.price,
          quantity: i.quantity,
        })),
      },
    },
  });
  const stockAlerts = reservation ? [] : await reserveStock(tx, serverItems, true, { orderId: order.id });
  return { order, stockAlerts };
  });

  if (deliveryData.deliveryStatus) {
    await prisma.deliveryEvent.create({ data: { orderId: order.id, status: "A_PREPARER", note: `${deliveryData.deliveryDistanceKm} km depuis le dépôt` } });
  }

  // 7. Effets de bord
  if (validConsultantId) {
    await notifySponsorOnSale(validConsultantId, total);
  }
  await sendLowStockAlerts(stockAlerts);

  // Notification admin (nouvelle commande)
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true },
  });
  if (admins.length > 0) {
    await prisma.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        orderId: order.id,
        title: reservation ? "Nouvelle réservation" : "Nouvelle commande",
        message: reservation
          ? `${data.customer.name} réserve ${serverItems[0].productName} (${serverItems[0].volumeLabel} × ${serverItems[0].quantity}) — acompte ${(reservationData.depositAmount ?? 0).toLocaleString("fr-FR")} FCFA`
          : `${data.customer.name} — ${total.toLocaleString("fr-FR")} FCFA`,
      })),
    });
  }

  // Notification consultant
  if (validConsultantId) {
    const consultantUser = await prisma.user.findFirst({
      where: { consultantId: validConsultantId },
      select: { id: true },
    });
    if (consultantUser) {
      await prisma.notification.create({
        data: {
          userId: consultantUser.id,
          orderId: order.id,
          title: "Nouvelle commande client",
          message: `${data.customer.name} a passé une commande de ${total.toLocaleString("fr-FR")} FCFA.`,
        },
      });
    }
  }

  if (reservation) notifyTeamWhatsApp(`Nouvelle réservation : ${serverItems[0].productName} (${serverItems[0].volumeLabel} × ${serverItems[0].quantity}) pour ${data.customer.name}. À commander chez Chogan. Détail : Admin > Réservations.`);
  else notifyTeamWhatsApp(`Nouvelle commande ${total.toLocaleString("fr-FR")} FCFA de ${data.customer.name}${validConsultantId ? " (via un consultant)" : ""}. Détail : Admin > Commandes.`);
  if (validConsultantId) {
    notifyResellerWhatsApp(validConsultantId, `Bonne nouvelle ! Nouvelle commande de ${data.customer.name} : ${total.toLocaleString("fr-FR")} FCFA, rattachée à vous. Suivez-la dans « Mes ventes ».`);
  }

  revalidatePath("/admin/commandes");
  revalidatePath("/admin/produits");
  revalidatePath("/admin/mes-commandes");

  return order.id;
}

/** Commissions du réseau : versées à la livraison (si choisi), annulées si la commande l'est. */
async function onOrderStatusChanged(id: string, status: OrderStatus) {
  if (status === "LIVREE") {
    // Livraison JAMAAL marquée livrée depuis la fiche commande : on clôt aussi l'étape de livraison.
    const closed = await prisma.order.updateMany({
      where: { id, deliveryMode: "LIVRAISON_JAMAAL", deliveryStatus: { not: "LIVREE" } },
      data: { deliveryStatus: "LIVREE", deliveredAt: new Date() },
    });
    if (closed.count) await prisma.deliveryEvent.create({ data: { orderId: id, status: "LIVREE", note: "Marquée livrée par l'équipe JAMAAL" } });
    after(async () => {
      await runPayoutsForOrder(id);
      await recordLivreurEarning(id).catch((e) => console.error("[livraison] part livreur", id, e));
    });
  }
  if (status === "ANNULEE") await cancelCommissionsForOrder(id);
  // Stock : remis à l'annulation, repris si la commande est réactivée (une seule fois).
  await syncOrderStock(id);
  revalidatePath("/admin/stocks");
}

export async function updateOrderStatus(id: string, status: OrderStatus) {
  await requireAdmin();
  await prisma.order.update({ where: { id }, data: { status } });
  if (status === "LIVREE") {
    await notifyConsultantOfDelivery(id);
  }
  await onOrderStatusChanged(id, status);
  revalidatePath("/admin/commandes");
  revalidatePath(`/admin/commandes/${id}`);
}

export async function assignOrderLogistics(id: string, formData: FormData) {
  await requireAdmin();
  const consultantId = String(formData.get("consultantId") ?? "") || null;
  const livreurId = String(formData.get("livreurId") ?? "") || null;
  const deliveryMode = String(formData.get("deliveryMode") ?? "RETRAIT_CONSULTANT") as
    | "RETRAIT_CONSULTANT"
    | "LIVRAISON_JAMAAL";
  const latRaw = String(formData.get("deliveryLat") ?? "").trim();
  const lngRaw = String(formData.get("deliveryLng") ?? "").trim();

  await prisma.order.update({
    where: { id },
    data: {
      consultantId,
      livreurId,
      deliveryMode,
      deliveryLat: latRaw ? Number(latRaw) : null,
      deliveryLng: lngRaw ? Number(lngRaw) : null,
    },
  });
  revalidatePath("/admin/commandes");
  revalidatePath(`/admin/commandes/${id}`);
  revalidatePath("/admin/mes-livraisons");
}

export async function livreurUpdateOrderStatus(id: string, status: OrderStatus) {
  const { livreur } = await requireLivreurProfile();
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order || order.livreurId !== livreur.id) {
    throw new Error("Cette commande ne vous est pas assignée");
  }
  await prisma.order.update({ where: { id }, data: { status } });
  if (status === "LIVREE") {
    await notifyConsultantOfDelivery(id);
  }
  await onOrderStatusChanged(id, status);
  revalidatePath("/admin/mes-livraisons");
}

/** Récupère une commande pour la page de confirmation (données publiques limitées). */
export async function getOrderConfirmation(id: string) {
  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      customerName: true,
      customerPhone: true,
      total: true,
      status: true,
      createdAt: true,
      address: true,
      paymentMethod: true,
      paymentStatus: true,
      giftWrap: true,
      giftMessage: true,
      paidAt: true,
      deliveryMode: true,
      deliveryFee: true,
      isReservation: true,
      depositAmount: true,
      depositPaidAt: true,
      reservationStatus: true,
      reservationDelay: true,
      consultant: { select: { name: true, city: true, whatsapp: true } },
      items: {
        select: {
          productName: true,
          volumeLabel: true,
          price: true,
          quantity: true,
        },
      },
    },
  });
  return order;
}

/** Articles disponibles, avec les prix actuels, pour un nouvel ajout au panier. */
export async function getOrderItemsForReorder(id: string) {
  const order = await prisma.order.findUnique({ where: { id }, include: { items: { include: { product: true, variant: true } } } });
  if (!order) return [];
  return order.items.flatMap((item) => {
    const product = item.product;
    if (!product) return [];
    const available = item.variant?.stock ?? product.stock;
    if (available <= 0) return [];
    const volumes = Array.isArray(product.volumes) ? product.volumes as { label: string; price: number }[] : [];
    const volume = volumes.find((entry) => entry.label === item.volumeLabel);
    const sample = item.volumeLabel.toLowerCase().includes("échantillon");
    const price = volume?.price ?? (sample ? product.testerPrice : product.regularPrice);
    if (!price || price <= 0) return [];
    return [{ productId: product.id, slug: product.slug, name: product.name, volumeLabel: item.volumeLabel, price, quantity: Math.min(item.quantity, available), colorFrom: product.colorFrom, colorTo: product.colorTo }];
  });
}
