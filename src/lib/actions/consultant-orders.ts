"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireConsultantProfile } from "./auth-guard";
import { upsertCustomerFromOrder } from "./customers";

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

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const customerId = customerPhone
    ? await upsertCustomerFromOrder({ name: customerName, phone: customerPhone, address })
    : null;

  const order = await prisma.order.create({
    data: {
      customerName,
      customerPhone: customerPhone || null,
      address,
      total,
      customerId,
      consultantId: consultant.id,
      deliveryMode,
      status: "CONFIRMEE",
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

  revalidatePath("/admin/mes-commandes");
  revalidatePath("/admin/commandes");
  redirect(`/admin/mes-commandes/${order.id}`);
}
