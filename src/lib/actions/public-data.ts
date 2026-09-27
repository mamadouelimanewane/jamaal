"use server";

import { prisma } from "@/lib/prisma";

export async function getActiveConsultantsForCheckout() {
  const consultants = await prisma.consultant.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, city: true },
  });
  return consultants;
}
