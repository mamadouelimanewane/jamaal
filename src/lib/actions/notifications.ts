"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "./auth-guard";

export async function markNotificationRead(id: string) {
  const session = await requireStaff();
  await prisma.notification.updateMany({
    where: { id, userId: session.user!.id },
    data: { read: true },
  });
  revalidatePath("/admin/notifications");
}

export async function markAllNotificationsRead() {
  const session = await requireStaff();
  await prisma.notification.updateMany({
    where: { userId: session.user!.id, read: false },
    data: { read: true },
  });
  revalidatePath("/admin/notifications");
}
