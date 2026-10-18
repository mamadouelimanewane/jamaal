"use server";

import { randomBytes, createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "./auth-guard";
import { backWithError } from "@/lib/form-error";
import { logActivity } from "@/lib/activity-log";
import { countFullAdmins } from "@/lib/access";
import { canonicalizePhone, phoneLookupVariants } from "@/lib/phone";
import { getSiteUrl } from "@/lib/site-url";
import { checkUserChange, isRoleName, passwordProblem, ROLE_LABEL, type UserChange } from "@/lib/user-rules";
import { Role } from "@prisma/client";

const page = (id: string) => `/admin/utilisateurs/${id}`;
const done = (id: string, msg: string): never => redirect(`${page(id)}?ok=${encodeURIComponent(msg)}`);

function refresh(id?: string) {
  revalidatePath("/admin/utilisateurs");
  if (id) revalidatePath(page(id));
}

async function loadTarget(id: string) {
  const t = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true, role: true, active: true, profileId: true, consultantId: true, livreurId: true, customerId: true } });
  if (!t) throw new Error("Compte introuvable.");
  return t;
}

/** Applique les règles de sécurité (dernier administrateur, auto-modification…). Lève une erreur lisible sinon. */
async function guard(actorId: string, id: string, change: UserChange) {
  const target = await loadTarget(id);
  const problem = checkUserChange(actorId, target, change, await countFullAdmins(id));
  if (problem) throw new Error(problem);
  return target;
}

// ---------- Identité ----------
async function updateIdentityImpl(id: string, fd: FormData) {
  const session = await requireAdmin("utilisateurs");
  const target = await loadTarget(id);
  const name = String(fd.get("name") ?? "").trim();
  const email = String(fd.get("email") ?? "").trim().toLowerCase() || null;
  const phoneRaw = String(fd.get("phone") ?? "").trim();
  const phone = phoneRaw ? canonicalizePhone(phoneRaw) : "";
  if (name.length < 2) throw new Error("Indiquez le nom.");
  if (email && !/^\S+@\S+\.\S+$/.test(email)) throw new Error("E-mail invalide.");
  if (!email && phone.length < 8) throw new Error("Indiquez un e-mail ou un numéro de téléphone valide : c'est l'identifiant de connexion.");
  if (email && (await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" }, id: { not: id } }, select: { id: true } }))) throw new Error("Un autre compte utilise déjà cet e-mail.");
  if (phone && (await prisma.user.findFirst({ where: { phone: { in: phoneLookupVariants(phone) }, id: { not: id } }, select: { id: true } }))) throw new Error("Un autre compte utilise déjà ce numéro de téléphone.");
  await prisma.user.update({ where: { id }, data: { name, email, phone: phone || null } });
  await logActivity(session, `Compte modifié : ${target.name}`, "User", id);
  refresh(id);
  done(id, "Informations enregistrées.");
}
export async function updateUserIdentity(id: string, fd: FormData): Promise<void> {
  try { await updateIdentityImpl(id, fd); } catch (e) { await backWithError(e, page(id)); }
}

// ---------- Rôle et privilèges ----------
async function setRoleImpl(id: string, fd: FormData) {
  const session = await requireAdmin("utilisateurs");
  const roleRaw = String(fd.get("role") ?? "");
  if (!isRoleName(roleRaw)) throw new Error("Rôle invalide.");
  const profileRaw = String(fd.get("profileId") ?? "");
  const profileId = roleRaw === "ADMIN" && profileRaw && profileRaw !== "__full__" ? profileRaw : null;
  if (profileId && !(await prisma.accessProfile.findUnique({ where: { id: profileId }, select: { id: true } }))) throw new Error("Profil introuvable.");
  const target = await guard(session.user!.id, id, { kind: "setRole", role: roleRaw, profileId });
  await prisma.user.update({ where: { id }, data: { role: roleRaw as Role, profileId } });
  const profile = profileId ? (await prisma.accessProfile.findUnique({ where: { id: profileId }, select: { name: true } }))?.name : null;
  await logActivity(session, `Rôle de ${target.name} : ${ROLE_LABEL[roleRaw]}${roleRaw === "ADMIN" ? ` · ${profile ? `profil « ${profile} »` : "accès complet"}` : ""}`, "User", id);
  refresh(id);
  done(id, "Rôle et privilèges enregistrés. L'utilisateur doit se reconnecter pour qu'ils s'appliquent.");
}
export async function setUserRole(id: string, fd: FormData): Promise<void> {
  try { await setRoleImpl(id, fd); } catch (e) { await backWithError(e, page(id)); }
}

// ---------- Statut ----------
async function setActiveImpl(id: string, active: boolean) {
  const session = await requireAdmin("utilisateurs");
  const target = active ? await loadTarget(id) : await guard(session.user!.id, id, { kind: "suspend" });
  await prisma.user.update({ where: { id }, data: { active } });
  // Un compte suspendu perd aussi ses liens de connexion en attente.
  if (!active) await prisma.passwordResetToken.deleteMany({ where: { userId: id } });
  await logActivity(session, `Compte ${active ? "réactivé" : "suspendu"} : ${target.name}`, "User", id);
  refresh(id);
  done(id, active ? "Compte réactivé." : "Compte suspendu : la personne est déconnectée au plus tard sous 5 minutes.");
}
export async function setUserActive(id: string, active: boolean): Promise<void> {
  try { await setActiveImpl(id, active); } catch (e) { await backWithError(e, page(id)); }
}

// ---------- Suppression ----------
async function deleteImpl(id: string) {
  const session = await requireAdmin("utilisateurs");
  const target = await guard(session.user!.id, id, { kind: "delete" });
  await prisma.user.delete({ where: { id } });
  await logActivity(session, `Compte supprimé : ${target.name}`, "User", id);
  revalidatePath("/admin/utilisateurs");
  redirect("/admin/utilisateurs?ok=" + encodeURIComponent("Compte supprimé."));
}
export async function deleteUserAccount(id: string): Promise<void> {
  try { await deleteImpl(id); } catch (e) { await backWithError(e, page(id)); }
}

// ---------- Mot de passe ----------
async function passwordImpl(id: string, fd: FormData) {
  const session = await requireAdmin("utilisateurs");
  const password = String(fd.get("password") ?? "");
  const problem = passwordProblem(password);
  if (problem) throw new Error(problem);
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true, email: true, phone: true } });
  if (!user) throw new Error("Compte introuvable.");
  const passwordHash = await bcrypt.hash(password, 10);
  const ids = [user.email?.toLowerCase(), user.phone].filter((v): v is string => !!v);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: { passwordHash } });
    await tx.passwordResetToken.deleteMany({ where: { userId: id } });
    if (ids.length) await tx.loginAttempt.deleteMany({ where: { identifiant: { in: ids } } });
  });
  await logActivity(session, `Mot de passe modifié pour ${user.name}`, "User", id);
  refresh(id);
  done(id, "Mot de passe modifié.");
}
export async function setUserPassword(id: string, fd: FormData): Promise<void> {
  try { await passwordImpl(id, fd); } catch (e) { await backWithError(e, page(id)); }
}

/** Lien d'accès à usage unique (7 jours) : la personne choisit elle-même son mot de passe. Retourne l'adresse à lui transmettre. */
export async function createAccessLink(id: string): Promise<{ ok: boolean; url?: string; error?: string }> {
  try {
    const session = await requireAdmin("utilisateurs");
    const user = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true, active: true } });
    if (!user) return { ok: false, error: "Compte introuvable." };
    if (!user.active) return { ok: false, error: "Compte suspendu : réactivez-le d'abord." };
    const token = randomBytes(32).toString("base64url");
    await prisma.passwordResetToken.create({ data: { tokenHash: createHash("sha256").update(token).digest("hex"), userId: id, expiresAt: new Date(Date.now() + 7 * 24 * 3600_000) } });
    await logActivity(session, `Lien d'accès généré pour ${user.name}`, "User", id);
    return { ok: true, url: `${await getSiteUrl()}/admin/reset-password?token=${encodeURIComponent(token)}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Impossible de générer le lien." };
  }
}
