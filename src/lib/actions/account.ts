"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type ChangePasswordState = { ok: boolean; error?: string };

/**
 * Tout compte connecté (administrateur, revendeur, livreur, client) change lui-même son mot de
 * passe, en confirmant l'ancien. Indisponible en mode « voir l'espace d'un consultant » : un
 * administrateur en consultation ne doit pas changer le mot de passe du consultant qu'il consulte
 * (sa session reste la sienne, donc l'action modifierait son propre compte sans que ce soit
 * l'intention affichée à l'écran).
 */
export async function changeOwnPassword(_prev: ChangePasswordState, formData: FormData): Promise<ChangePasswordState> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Session invalide." };
  // Le cookie « voir son espace » n'a de sens que pour un administrateur en consultation : il ne
  // doit jamais bloquer un autre rôle (revendeur, livreur, client) à tort.
  if (session.user.role === "ADMIN" && (await cookies()).get("jamaal_viewas")?.value) {
    return { ok: false, error: "Mode consultation : quittez « Voir son espace » pour changer un mot de passe." };
  }

  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");
  if (!current) return { ok: false, error: "Indiquez votre mot de passe actuel." };
  if (next.length < 8) return { ok: false, error: "Nouveau mot de passe : 8 caractères au moins." };
  if (next !== confirm) return { ok: false, error: "Les deux mots de passe ne correspondent pas." };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, phone: true, passwordHash: true },
  });
  if (!user) return { ok: false, error: "Compte introuvable." };

  const valid = await bcrypt.compare(current, user.passwordHash);
  if (!valid) return { ok: false, error: "Mot de passe actuel incorrect." };

  const passwordHash = await bcrypt.hash(next, 12);
  // L'identifiant utilisé à la prochaine connexion peut être l'e-mail ou le téléphone : on efface
  // le compteur de tentatives pour les deux, selon ce que le compte possède.
  const identifiants = [user.email?.toLowerCase(), user.phone].filter((v): v is string => !!v);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
    await tx.passwordResetToken.deleteMany({ where: { userId: user.id } });
    if (identifiants.length) await tx.loginAttempt.deleteMany({ where: { identifiant: { in: identifiants } } });
    await tx.activityLog.create({
      data: { userId: user.id, userName: user.name, action: "Mot de passe modifié", entity: "User", entityId: user.id },
    });
  });

  return { ok: true };
}
