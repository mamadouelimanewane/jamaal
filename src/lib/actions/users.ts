"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "./auth-guard";
import { Role } from "@prisma/client";

export async function createUser(formData: FormData) {
  await requireAdmin();
  const email = String(formData.get("email") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = (String(formData.get("role") ?? "CONSULTANT") as Role) ?? Role.CONSULTANT;

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({ data: { email, name, passwordHash, role } });
  revalidatePath("/admin/utilisateurs");
  redirect("/admin/utilisateurs");
}

export async function deleteUser(id: string) {
  const session = await requireAdmin();
  if (session.user?.id === id) throw new Error("Vous ne pouvez pas supprimer votre propre compte");
  await prisma.user.delete({ where: { id } });
  revalidatePath("/admin/utilisateurs");
}
