"use server";

import { backWithError } from "@/lib/form-error";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "./auth-guard";
import { Role } from "@prisma/client";
import { uniqueConsultantSlug } from "@/lib/unique-slug";

/** Nom propre : « AWA HAYIBOR » → « Awa Hayibor ». */
const tidyName = (n: string) => (n === n.toUpperCase() ? n.toLowerCase().replace(/(^|[\s'-])\p{L}/gu, (m) => m.toUpperCase()) : n);

/** Fiche revendeur ou livreur à rattacher : celle choisie, sinon une nouvelle fiche créée à partir du compte. */
async function profileFor(role: Role, formData: FormData, name: string, email: string) {
  const city = String(formData.get("city") ?? "").trim() || "Dakar";
  const phone = String(formData.get("phone") ?? "").trim();
  if (role === "CONSULTANT") {
    const chosen = String(formData.get("consultantId") ?? "");
    if (chosen && chosen !== "__new__") {
      const c = await prisma.consultant.findUnique({ where: { id: chosen }, select: { id: true, user: { select: { id: true } } } });
      if (!c) throw new Error("Fiche consultant introuvable.");
      if (c.user) throw new Error("Cette fiche consultant a déjà un compte.");
      return { consultantId: c.id, livreurId: null };
    }
    const free = await prisma.consultant.findFirst({ where: { email: { equals: email, mode: "insensitive" }, user: null }, select: { id: true } });
    if (free) return { consultantId: free.id, livreurId: null };
    const c = await prisma.consultant.create({ data: { name: tidyName(name), city, whatsapp: phone, email, active: true, slug: await uniqueConsultantSlug(name) } });
    return { consultantId: c.id, livreurId: null };
  }
  if (role === "LIVREUR") {
    const chosen = String(formData.get("livreurId") ?? "");
    if (chosen && chosen !== "__new__") {
      const l = await prisma.livreur.findUnique({ where: { id: chosen }, select: { id: true, user: { select: { id: true } } } });
      if (!l) throw new Error("Fiche livreur introuvable.");
      if (l.user) throw new Error("Cette fiche livreur a déjà un compte.");
      return { consultantId: null, livreurId: l.id };
    }
    const l = await prisma.livreur.create({ data: { name: tidyName(name), phone, active: true } });
    return { consultantId: null, livreurId: l.id };
  }
  return { consultantId: null, livreurId: null };
}

async function createUserImpl(formData: FormData) {
  await requireAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const roleRaw = String(formData.get("role") ?? "CONSULTANT");
  const role: Role = roleRaw === "ADMIN" ? Role.ADMIN : roleRaw === "LIVREUR" ? Role.LIVREUR : Role.CONSULTANT;
  if (name.length < 2) throw new Error("Indiquez le nom.");
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("E-mail invalide.");
  if (password.length < 8) throw new Error("Mot de passe : 8 caractères au moins.");
  if (await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } })) throw new Error("Un compte existe déjà avec cet e-mail.");

  const links = await profileFor(role, formData, name, email);
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({ data: { email, name: tidyName(name), passwordHash, role, ...links } });
  revalidatePath("/admin/utilisateurs");
  revalidatePath("/admin/consultants");
  redirect("/admin/utilisateurs");
}

/** Rattache un compte existant (revendeur ou livreur sans fiche) à une fiche, ou lui en crée une. */
async function attachUserImpl(userId: string, formData: FormData) {
  await requireAdmin();
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, role: true, consultantId: true, livreurId: true } });
  if (!user) throw new Error("Compte introuvable.");
  if (user.role === "ADMIN") throw new Error("Un administrateur n'a pas de fiche.");
  if ((user.role === "CONSULTANT" && user.consultantId) || (user.role === "LIVREUR" && user.livreurId)) throw new Error("Ce compte est déjà rattaché.");
  const links = await profileFor(user.role, formData, user.name, user.email);
  await prisma.user.update({ where: { id: user.id }, data: links });
  revalidatePath("/admin/utilisateurs");
  revalidatePath("/admin/consultants");
}

async function deleteUserImpl(id: string) {
  const session = await requireAdmin();
  if (session.user?.id === id) throw new Error("Vous ne pouvez pas supprimer votre propre compte");
  await prisma.user.delete({ where: { id } });
  revalidatePath("/admin/utilisateurs");
}

// Actions appelées par les formulaires : erreurs affichées sur la page, jamais une page d'erreur.
export async function createUser(formData: FormData): Promise<void> {
  try {
    await createUserImpl(formData);
  } catch (e) {
    await backWithError(e, "/admin/utilisateurs");
  }
}

export async function deleteUser(id: string): Promise<void> {
  try {
    await deleteUserImpl(id);
  } catch (e) {
    await backWithError(e, "/admin/utilisateurs");
  }
}

export async function attachUser(userId: string, formData: FormData): Promise<void> {
  try {
    await attachUserImpl(userId, formData);
  } catch (e) {
    await backWithError(e, "/admin/utilisateurs");
  }
}
