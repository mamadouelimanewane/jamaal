"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getReseller } from "@/lib/reseller";

export type ProfileState = { ok: boolean; error?: string };

const schema = z.object({
  name: z.string().trim().min(2, "Indiquez votre nom.").max(100),
  city: z.string().trim().min(2, "Indiquez votre ville.").max(80),
  whatsapp: z.string().trim().regex(/^\+?[\d\s().-]{8,20}$/, "Numéro WhatsApp invalide (ex. +221 77 000 00 00)."),
});

/** Le consultant modifie ses propres informations de contact (jamais celles d'un autre). */
export async function updateOwnProfile(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const me = await getReseller();
  if (!me) return { ok: false, error: "Session invalide." };
  // Le mode « voir son espace » de l'administrateur est en lecture seule.
  if (me.viewAs) return { ok: false, error: "Mode consultation : modification impossible. Quittez « Voir son espace » pour modifier ce profil depuis la fiche consultant." };
  const parsed = schema.safeParse({
    name: formData.get("name") ?? "",
    city: formData.get("city") ?? "",
    whatsapp: formData.get("whatsapp") ?? "",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };

  await prisma.$transaction([
    prisma.consultant.update({ where: { id: me.id }, data: parsed.data }),
    prisma.user.update({ where: { id: me.userId }, data: { name: parsed.data.name } }),
  ]);
  revalidatePath("/admin/mon-profil");
  revalidatePath("/consultants");
  return { ok: true };
}
