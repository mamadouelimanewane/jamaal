"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "./auth-guard";
import { OrderStatus } from "@prisma/client";

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

export async function createOrder(customer: CheckoutCustomer, items: CheckoutItem[]) {
  if (items.length === 0) throw new Error("Panier vide");
  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  const order = await prisma.order.create({
    data: {
      customerName: customer.name,
      customerEmail: customer.email || null,
      customerPhone: customer.phone || null,
      address: customer.address || null,
      total,
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

  revalidatePath("/admin/commandes");
  return order.id;
}

export async function updateOrderStatus(id: string, status: OrderStatus) {
  await requireStaff();
  await prisma.order.update({ where: { id }, data: { status } });
  revalidatePath("/admin/commandes");
  revalidatePath(`/admin/commandes/${id}`);
}
