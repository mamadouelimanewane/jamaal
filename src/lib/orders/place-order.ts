/**
 * Création d'une commande (panier du site, ou commande prise sur WhatsApp par l'assistant).
 * Module serveur ordinaire (pas une action) : seules les actions de src/lib/actions l'exposent.
 */
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { upsertCustomerFromOrder } from "@/lib/customers";
import { notifySponsorOnSale } from "@/lib/sponsor-notifications";
import { notifyResellerWhatsApp, notifyTeamWhatsApp } from "@/lib/whatsapp";
import { reserveStock, resolveStockRef, sendLowStockAlerts, UNIQUE_FORMAT } from "@/lib/stock";
import { createOrderSchema } from "@/lib/validations/order";
import { rateLimit, clientIpFromHeaders } from "@/lib/rate-limit";
import { getBusinessModel } from "@/lib/business-model-store";
import { isValidPoint, newDeliveryCode, quoteDelivery } from "@/lib/delivery";
import { depositFor } from "@/lib/reservation";
import { getReservationSettings } from "@/lib/reservation-store";
import { codeDiscount, offerDiscount, resolveDiscountCode } from "@/lib/offers";
import { phoneLookupVariants } from "@/lib/phone";

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

export interface PlaceOrderOptions {
  /** Clé de limitation (défaut : adresse IP de la requête). */
  rateKey?: string;
  /** Origine affichée dans les notifications (ex. « WhatsApp »). */
  channel?: string;
  /** Code promo saisi par le client (code JAMAAL, code d'un revendeur ou code anniversaire). */
  couponCode?: string;
}

export async function placeOrder(
  customer: CheckoutCustomer,
  items: CheckoutItem[],
  consultantId?: string | null,
  acceptCgv: boolean = false,
  giftWrap: boolean = false,
  giftMessage: string = "",
  delivery: CheckoutDelivery = { mode: "RETRAIT" },
  reservation: boolean = false,
  opts: PlaceOrderOptions = {}
): Promise<string> {
  // 0. Rate limiting (par IP pour le site ; par numéro pour une commande WhatsApp)
  const rateKey = opts.rateKey ?? `order:${clientIpFromHeaders(await headers())}`;
  const limited = await rateLimit(rateKey, { limit: 5, windowMs: 60_000 });
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

  // 3 quater. Offre de fêtes (coffret à prix spécial) : remise calculée côté serveur.
  let offerData: { discountAmount?: number; offerTitle?: string; couponId?: string } = {};
  if (!reservation) {
    const now = new Date();
    const offers = await prisma.offer.findMany({ where: { active: true, startsAt: { lte: now }, endsAt: { gte: now } }, select: { id: true, title: true, productIds: true, packPrice: true } });
    const best = offerDiscount(offers, serverItems);
    if (best) {
      total -= best.discount;
      offerData = { discountAmount: best.discount, offerTitle: best.packs > 1 ? `${best.offer.title} × ${best.packs}` : best.offer.title };
    }
  }
  // Code promo : sur le montant des produits (après l'offre). Le code d'un revendeur lui attribue la vente.
  let codeRef: Awaited<ReturnType<typeof resolveDiscountCode>> = null;
  if (!reservation && opts.couponCode?.trim()) {
    codeRef = await resolveDiscountCode(opts.couponCode);
    if (!codeRef || "error" in codeRef) throw new Error(codeRef && "error" in codeRef ? codeRef.error : "Code promo inconnu.");
    const off = codeDiscount(codeRef.kind, codeRef.value, total);
    if (off > 0) {
      total -= off;
      offerData = {
        discountAmount: (offerData.discountAmount ?? 0) + off,
        offerTitle: [offerData.offerTitle, `code ${codeRef.code}`].filter(Boolean).join(" · "),
        ...(codeRef.source === "coupon" ? { couponId: codeRef.id } : {}),
      };
      if (codeRef.source === "promo" && codeRef.consultantId && !data.consultantId) data.consultantId = codeRef.consultantId;
    }
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
      ...offerData,
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
  if (codeRef && !("error" in codeRef) && offerData.discountAmount) {
    if (codeRef.source === "coupon") await tx.coupon.update({ where: { id: codeRef.id }, data: { usedCount: { increment: 1 } } });
    else await tx.promoCode.update({ where: { id: codeRef.id }, data: { usedCount: { increment: 1 } } });
  }
  const stockAlerts = reservation ? [] : await reserveStock(tx, serverItems, true, { orderId: order.id });
  return { order, stockAlerts };
  });

  // Panier relancé : il est devenu une commande.
  if (data.customer.phone) {
    await prisma.abandonedCart.updateMany({ where: { phone: { in: phoneLookupVariants(data.customer.phone) }, orderedAt: null }, data: { orderedAt: new Date() } }).catch(() => {});
  }

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
  else notifyTeamWhatsApp(`Nouvelle commande${opts.channel ? ` ${opts.channel}` : ""} ${total.toLocaleString("fr-FR")} FCFA de ${data.customer.name}${validConsultantId ? " (via un consultant)" : ""}${offerData.offerTitle ? ` · offre ${offerData.offerTitle}` : ""}. Détail : Admin > Commandes.`);
  if (validConsultantId) {
    notifyResellerWhatsApp(validConsultantId, `Bonne nouvelle ! Nouvelle commande de ${data.customer.name} : ${total.toLocaleString("fr-FR")} FCFA, rattachée à vous. Suivez-la dans « Mes ventes ».`);
  }

  revalidatePath("/admin/commandes");
  revalidatePath("/admin/produits");
  revalidatePath("/admin/mes-commandes");

  return order.id;
}
