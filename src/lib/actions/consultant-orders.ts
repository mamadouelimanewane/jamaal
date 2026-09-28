"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireConsultantProfile } from "./auth-guard";
import { upsertCustomerFromOrder } from "./customers";
import { notifySponsorOnFirstSale } from "@/lib/sponsor-notifications";
import { decrementStockAndAlert } from "@/lib/stock";

import { getLoyaltySettings } from "@/lib/settings";

export interface ConsultantOrderItem {
  productId: string;
  productName: string;
  volumeLabel: string;
  price: number;
  quantity: number;
}

export async function createConsultantOrder(formData: FormData) {
  const { consultant } = await requireConsultantProfile();

  const itemsRaw = String(formData.get("items") ?? "[]");
  const items: ConsultantOrderItem[] = JSON.parse(itemsRaw);
  if (items.length === 0) throw new Error("Ajoutez au moins un produit");

  const customerName = String(formData.get("customerName") ?? "").trim();
  const customerPhone = String(formData.get("customerPhone") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim() || null;
  const deliveryMode = String(formData.get("deliveryMode") ?? "RETRAIT_CONSULTANT") as
    | "RETRAIT_CONSULTANT"
    | "LIVRAISON_JAMAAL";
  const useLoyaltyPoints = formData.get("useLoyaltyPoints") === "on";

  let total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  let discountAmount = 0;

  const customerId = customerPhone
    ? await upsertCustomerFromOrder({ name: customerName, phone: customerPhone, address })
    : null;

  if (customerId && useLoyaltyPoints) {
    const cust = await prisma.customer.findUnique({ where: { id: customerId } });
    if (cust && cust.loyaltyPoints > 0) {
      const { redemptionValue } = await getLoyaltySettings();
      const pointsValue = cust.loyaltyPoints * redemptionValue;
      discountAmount = Math.min(total, pointsValue);
      total -= discountAmount;
      
      const pointsToDeduct = Math.ceil(discountAmount / redemptionValue);
      await prisma.customer.update({
        where: { id: customerId },
        data: { loyaltyPoints: { decrement: pointsToDeduct } }
      });
    }
  }

  const order = await prisma.order.create({
    data: {
      customerName,
      customerPhone: customerPhone || null,
      address,
      total,
      discountAmount,
      customerId,
      consultantId: consultant.id,
      deliveryMode,
      status: "CONFIRMEE",
      statusHistory: {
        create: { status: "CONFIRMEE" }
      },
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

  await notifySponsorOnFirstSale(consultant.id);
  await decrementStockAndAlert(items);

  revalidatePath("/admin/mes-commandes");
  revalidatePath("/admin/commandes");
  revalidatePath("/admin/produits");
  redirect(`/admin/mes-commandes/${order.id}`);
}

