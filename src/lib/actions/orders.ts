"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireLivreurProfile } from "./auth-guard";
import { OrderStatus } from "@prisma/client";
import { upsertCustomerFromOrder } from "./customers";
import { notifyConsultantOfDelivery } from "@/lib/notifications";
import { notifySponsorOnFirstSale } from "@/lib/sponsor-notifications";
import { decrementStockAndAlert } from "@/lib/stock";

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

export async function createOrder(
  customer: CheckoutCustomer,
  items: CheckoutItem[],
  consultantId?: string | null
) {
  if (items.length === 0) throw new Error("Panier vide");
  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const customerId = customer.phone
    ? await upsertCustomerFromOrder({
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
      })
    : null;

  const order = await prisma.order.create({
    data: {
      customerName: customer.name,
      customerEmail: customer.email || null,
      customerPhone: customer.phone || null,
      address: customer.address || null,
      total,
      customerId,
      consultantId: consultantId || null,
      items: {
        create: items.map((i) => ({
          productId: i.productId,
          productName: i.productName,
          volumeLabel: i.volumeLabel,
          price: i.price,
          quantity: i.quantity,
        })),
      },
    },
  });

  if (consultantId) {
    await notifySponsorOnFirstSale(consultantId);
  }
  await decrementStockAndAlert(items);

  revalidatePath("/admin/commandes");
  revalidatePath("/admin/produits");
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
