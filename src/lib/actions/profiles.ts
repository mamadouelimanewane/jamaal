"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "./auth-guard";
import { backWithError } from "@/lib/form-error";
import { logActivity } from "@/lib/activity-log";
import { MODULE_IDS, PROFILE_TEMPLATES, normalizePermissions, summarizePermissions, type Permissions } from "@/lib/permissions";

const LIST = "/admin/utilisateurs/profils";
const ok = (msg: string): never => redirect(`${LIST}?ok=${encodeURIComponent(msg)}`);

/** Privilèges saisis dans la grille (champs perm_<module> = none | read | write). Le module « Utilisateurs » n'est jamais délégable. */
function permissionsFromForm(fd: FormData): Permissions {
  const raw: Record<string, string> = {};
  for (const m of MODULE_IDS) {
    if (m === "utilisateurs") continue;
    const v = String(fd.get(`perm_${m}`) ?? "none");
    if (v === "read" || v === "write") raw[m] = v;
  }
  return normalizePermissions(raw);
}

async function saveImpl(fd: FormData) {
  const session = await requireAdmin("utilisateurs");
  const id = String(fd.get("id") ?? "");
  const name = String(fd.get("name") ?? "").trim();
  const description = String(fd.get("description") ?? "").trim().slice(0, 200) || null;
  if (name.length < 2 || name.length > 60) throw new Error("Donnez un nom au profil (2 à 60 caractères).");
  const permissions = permissionsFromForm(fd);
  if (!Object.keys(permissions).length) throw new Error("Choisissez au moins un module, en lecture ou en écriture.");
  const clash = await prisma.accessProfile.findFirst({ where: { name: { equals: name, mode: "insensitive" }, ...(id ? { id: { not: id } } : {}) }, select: { id: true } });
  if (clash) throw new Error("Un profil porte déjà ce nom.");
  const data = { name, description, permissions: permissions as unknown as Prisma.InputJsonValue };
  if (id) {
    await prisma.accessProfile.update({ where: { id }, data });
    await logActivity(session, `Profil modifié : ${name} (${summarizePermissions(permissions)})`, "AccessProfile", id);
  } else {
    const created = await prisma.accessProfile.create({ data });
    await logActivity(session, `Profil créé : ${name} (${summarizePermissions(permissions)})`, "AccessProfile", created.id);
  }
  revalidatePath(LIST);
  revalidatePath("/admin/utilisateurs");
  ok(id ? "Profil enregistré. Les utilisateurs concernés doivent se reconnecter pour que les changements s'appliquent." : "Profil créé.");
}
export async function saveProfile(fd: FormData): Promise<void> {
  try { await saveImpl(fd); } catch (e) { await backWithError(e, LIST); }
}

async function deleteImpl(id: string) {
  const session = await requireAdmin("utilisateurs");
  const profile = await prisma.accessProfile.findUnique({ where: { id }, select: { name: true, _count: { select: { users: true } } } });
  if (!profile) throw new Error("Profil introuvable.");
  // Supprimer un profil encore attribué ferait passer ses utilisateurs en administrateurs complets : on l'interdit.
  if (profile._count.users > 0) throw new Error(`Ce profil est attribué à ${profile._count.users} utilisateur(s) : changez d'abord leur profil, sinon ils deviendraient administrateurs complets.`);
  await prisma.accessProfile.delete({ where: { id } });
  await logActivity(session, `Profil supprimé : ${profile.name}`, "AccessProfile", id);
  revalidatePath(LIST);
  ok("Profil supprimé.");
}
export async function deleteProfile(id: string): Promise<void> {
  try { await deleteImpl(id); } catch (e) { await backWithError(e, LIST); }
}

async function templateImpl(index: number) {
  const session = await requireAdmin("utilisateurs");
  const t = PROFILE_TEMPLATES[index];
  if (!t) throw new Error("Modèle introuvable.");
  if (await prisma.accessProfile.findFirst({ where: { name: { equals: t.name, mode: "insensitive" } }, select: { id: true } })) throw new Error(`Le profil « ${t.name} » existe déjà.`);
  const created = await prisma.accessProfile.create({ data: { name: t.name, description: t.description, permissions: t.permissions as unknown as Prisma.InputJsonValue } });
  await logActivity(session, `Profil créé depuis un modèle : ${t.name}`, "AccessProfile", created.id);
  revalidatePath(LIST);
  ok(`Profil « ${t.name} » créé.`);
}
export async function createProfileFromTemplate(index: number): Promise<void> {
  try { await templateImpl(index); } catch (e) { await backWithError(e, LIST); }
}
