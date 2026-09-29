"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireLivreurProfile } from "./auth-guard";
import { OrderStatus } from "@prisma/client";
import { upsertCustomerFromOrder } from "./customers";
import { notifyConsultantOfDelivery } from "@/lib/notifications";
import { notifySponsorOnSale } from "@/lib/sponsor-notifications";
import { decrementStockAndAlert } from "@/lib/stock";
import { createOrderSchema } from "@/lib/validations/order";
import { rateLimit, clientIpFromHeaders } from "@/lib/rate-limit";

export interface CheckoutItem {
  productId: string;
  productName: string;
  volumeLabel: string;
  price: number;
  quantity: number;
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
export async function createOrder(
  customer: CheckoutCustomer,
  items: CheckoutItem[],
  consultantId?: string | null,
  acceptCgv: boolean = false,
  giftWrap: boolean = false,
  giftMessage: string = ""
) {
  // 0. Rate limiting
  const h = await headers();
  const ip = clientIpFromHeaders(h);
  const limited = rateLimit(`order:${ip}`, { limit: 5, windowMs: 60_000 });
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

    if (product.stock < item.quantity) {
      throw new Error(
        `Stock insuffisant pour « ${product.name} » (disponible : ${product.stock}).`
      );
    }

    // Prix serveur : on accepte le prix client s'il correspond à un volume connu,
    // sinon on refuse (évite la manipulation).
    const volumes = (product.volumes as { label: string; price: number }[] | null) ?? [];
    const matchedVolume = volumes.find(
      (v) => v.label === item.volumeLabel && v.price === item.price
    );
    const isTester =
      product.testerPrice != null &&
      item.volumeLabel.toLowerCase().includes("échantillon") &&
      item.price === product.testerPrice;
    const isRegular =
      product.regularPrice != null &&
      item.price === product.regularPrice &&
      (!volumes.length || volumes.some((v) => v.label === item.volumeLabel));

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

  // 6. Création atomique de la commande
  const order = await prisma.order.create({
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
      items: {
        create: serverItems.map((i) => ({
          productId: i.productId,
          productName: i.productName,
          volumeLabel: i.volumeLabel,
          price: i.price,
          quantity: i.quantity,
        })),
      },
    },
  });

  // 7. Effets de bord
  if (validConsultantId) {
    await notifySponsorOnSale(validConsultantId, total);
  }
  await decrementStockAndAlert(serverItems);

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
        title: "Nouvelle commande",
        message: `${data.customer.name} — ${total.toLocaleString("fr-FR")} FCFA`,
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

  revalidatePath("/admin/commandes");
  revalidatePath("/admin/produits");
  revalidatePath("/admin/mes-commandes");

  return order.id;
}

export async function updateOrderStatus(id: string, status: OrderStatus) {
  await requireAdmin();
  await prisma.order.update({ where: { id }, data: { status } });
  if (status === "LIVREE") {
    await notifyConsultantOfDelivery(id);
  }
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
