"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { clientIpFromHeaders, rateLimit } from "@/lib/rate-limit";
import { accountsByPhone } from "@/lib/staff-accounts";
import { phoneLookupVariants } from "@/lib/phone";
import { phoneTail } from "@/lib/phone-match";
import { notifyTeamWhatsApp } from "@/lib/whatsapp";
import { LIVREUR_ACTIVE, LIVREUR_PENDING, LIVREUR_REFUSED, docFileError, livreurLoginEmail, idTypeLabel, needsVerso, parseLivreurSignup, sniffDocType, vehicleLabel } from "@/lib/livreur-signup";
import { requireAdmin } from "./auth-guard";

export type SignupState = { ok: boolean; error?: string; field?: string; name?: string; phone?: string; values?: Record<string, string>; n?: number } | null;

/** Valeurs renvoyées au formulaire après une erreur (jamais les mots de passe). */
const KEEP = ["name", "phone", "zone", "vehicle", "walletProvider", "walletNumber", "idType", "idNumber"] as const;

type Doc = { side: "RECTO" | "VERSO"; mime: string; data: Uint8Array<ArrayBuffer> };

/** Lit et contrôle une photo de pièce (taille, format annoncé et contenu réel du fichier). */
async function readDoc(f: FormDataEntryValue | null, side: Doc["side"], what: string): Promise<Doc | string> {
  const file = f instanceof File ? f : null;
  const err = docFileError(file, what);
  if (err) return err;
  const data = new Uint8Array(await file!.arrayBuffer());
  const mime = sniffDocType(data);
  if (!mime) return `Photo ${what} illisible : reprenez la photo (JPEG, PNG ou PDF).`;
  return { side, mime, data };
}
const keepValues = (f: FormData) => Object.fromEntries(KEEP.map((k) => [k, String(f.get(k) ?? "").slice(0, 120)]));

/**
 * Inscription depuis l'application JAMAAL Livreur : fiche livreur + compte créés INACTIFS, à valider par
 * l'administrateur (Livraison › Livreurs). Le livreur ne peut pas se connecter avant la validation.
 */
export async function registerLivreur(prev: SignupState, formData: FormData): Promise<SignupState> {
  const fail = (error: string, field?: string): SignupState => ({ ok: false, error, field, values: keepValues(formData), n: (prev?.n ?? 0) + 1 });
  if (String(formData.get("website") ?? "")) return { ok: true, name: "" }; // piège à robots
  const ip = clientIpFromHeaders(await headers());
  const limited = await rateLimit(`livreur-signup:${ip}`, { limit: 5, windowMs: 3_600_000 });
  if (!limited.ok) return fail("Trop d'inscriptions depuis ce téléphone. Réessayez dans une heure ou écrivez à l'équipe JAMAAL.");

  const check = parseLivreurSignup(formData);
  if (!check.ok) return fail(check.error, check.field);
  const d = check.data;

  const recto = await readDoc(formData.get("idRecto"), "RECTO", "du recto");
  if (typeof recto === "string") return fail(recto, "idRecto");
  const docs: Doc[] = [recto];
  if (needsVerso(d.idType)) {
    const verso = await readDoc(formData.get("idVerso"), "VERSO", "du verso");
    if (typeof verso === "string") return fail(verso, "idVerso");
    docs.push(verso);
  }

  const tail = phoneTail(d.phone);
  const [accounts, sameLivreur] = await Promise.all([
    accountsByPhone(d.phone),
    prisma.$queryRaw<{ id: string; status: string }[]>`SELECT id, status FROM "Livreur" WHERE right(regexp_replace(phone, '[^0-9]', '', 'g'), 9) = ${tail} LIMIT 1`,
  ]);
  if (sameLivreur[0]?.status === LIVREUR_PENDING) return fail("Une inscription avec ce numéro est déjà en cours de validation. Vous serez prévenu sur WhatsApp.", "phone");
  // Inscription refusée auparavant : le livreur peut se réinscrire (l'ancienne demande est effacée).
  const refusedId = sameLivreur[0]?.status === LIVREUR_REFUSED ? sameLivreur[0].id : null;
  // Un revendeur (ou un client) peut aussi devenir livreur avec le même numéro : seul un compte LIVREUR existant bloque.
  const livreurAccount = accounts.some((a) => a.role === "LIVREUR" && !refusedId);
  if (livreurAccount || (sameLivreur.length && !refusedId)) return fail("Ce numéro a déjà un compte livreur JAMAAL : connectez-vous avec « J'ai déjà un compte ».", "phone");
  // Le numéro est déjà celui d'un autre compte (revendeur, client) : le compte livreur est séparé, retrouvé
  // par le numéro de sa fiche livreur à la connexion (voir staff-accounts.ts).
  const phoneTaken = !!(await prisma.user.findFirst({ where: { phone: { in: phoneLookupVariants(d.phone) } }, select: { id: true } }));

  const passwordHash = await bcrypt.hash(d.password, 10);
  try {
    await prisma.$transaction(async (tx) => {
      if (refusedId) {
        await tx.user.deleteMany({ where: { livreurId: refusedId } });
        await tx.livreur.delete({ where: { id: refusedId } });
      }
      const l = await tx.livreur.create({
        data: { name: d.name, phone: d.phone, active: false, status: LIVREUR_PENDING, vehicle: d.vehicle, zone: d.zone, idType: d.idType, idNumber: d.idNumber, walletProvider: d.walletProvider, walletNumber: d.walletNumber },
      });
      await tx.user.create({ data: { name: d.name, ...(phoneTaken ? { phone: null, email: livreurLoginEmail(d.phone) } : { phone: d.phone }), passwordHash, role: Role.LIVREUR, active: false, livreurId: l.id } });
      await tx.livreurDocument.createMany({ data: docs.map((doc) => ({ livreurId: l.id, kind: d.idType, side: doc.side, mime: doc.mime, size: doc.data.byteLength, data: doc.data })) });
    }, { timeout: 20_000 });
  } catch (e) {
    console.error("[inscription livreur]", e);
    return fail("Ce numéro a déjà un compte livreur JAMAAL : connectez-vous avec « J'ai déjà un compte ».", "phone");
  }

  const msg = `${d.name} (${d.phone}) · ${vehicleLabel(d.vehicle)} · ${d.zone} · ${idTypeLabel(d.idType)} fournie`;
  const admins = await prisma.user.findMany({ where: { role: "ADMIN", active: true }, select: { id: true }, take: 30 });
  if (admins.length) await prisma.notification.createMany({ data: admins.map((a) => ({ userId: a.id, title: "Nouveau livreur à valider 🛵", message: `${msg}. À valider dans Livraison › Livreurs.` })) }).catch(() => {});
  notifyTeamWhatsApp(`🛵 Nouvelle inscription livreur à valider : ${msg}.`);
  revalidatePath("/admin/livreurs");
  return { ok: true, name: d.name.split(" ")[0], phone: d.phone };
}

/** Validation par l'administrateur : pièce d'identité contrôlée, la fiche devient active et le livreur peut se connecter. */
export async function approveLivreur(id: string) {
  await requireAdmin("livraison");
  const l = await prisma.livreur.findUnique({ where: { id }, select: { id: true, _count: { select: { documents: true } } } });
  if (!l) redirect("/admin/livreurs");
  if (!l._count.documents) redirect("/admin/livreurs?erreur=piece");
  await prisma.$transaction([
    prisma.livreur.update({ where: { id }, data: { active: true, status: LIVREUR_ACTIVE, docsVerifiedAt: new Date(), rejectReason: null } }),
    prisma.user.updateMany({ where: { livreurId: id }, data: { active: true } }),
  ]);
  revalidatePath("/admin/livreurs");
  redirect(`/admin/livreurs?valide=${encodeURIComponent(id)}`);
}

/**
 * Refus avec un motif : le compte reste bloqué, les photos de la pièce sont effacées aussitôt.
 * Le livreur pourra se réinscrire avec le même numéro.
 */
export async function rejectLivreur(id: string, formData: FormData) {
  await requireAdmin("livraison");
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 200) || "Dossier incomplet";
  const l = await prisma.livreur.findUnique({ where: { id }, select: { status: true } });
  if (!l || l.status !== LIVREUR_PENDING) redirect("/admin/livreurs");
  await prisma.$transaction([
    prisma.livreurDocument.deleteMany({ where: { livreurId: id } }),
    prisma.livreur.update({ where: { id }, data: { status: LIVREUR_REFUSED, active: false, rejectReason: reason } }),
    prisma.user.updateMany({ where: { livreurId: id }, data: { active: false } }),
  ]);
  revalidatePath("/admin/livreurs");
  redirect(`/admin/livreurs?refuse=${encodeURIComponent(id)}`);
}

/** Suspension / réactivation d'un livreur validé (connexion coupée aussitôt). */
export async function setLivreurSuspended(id: string, suspended: boolean) {
  await requireAdmin("livraison");
  const l = await prisma.livreur.findUnique({ where: { id }, select: { status: true, _count: { select: { documents: true } } } });
  if (!l || l.status !== LIVREUR_ACTIVE) redirect("/admin/livreurs");
  if (!suspended && !l._count.documents) redirect("/admin/livreurs?erreur=piece");
  await prisma.$transaction([
    prisma.livreur.update({ where: { id }, data: { active: !suspended } }),
    prisma.user.updateMany({ where: { livreurId: id }, data: { active: !suspended } }),
  ]);
  revalidatePath("/admin/livreurs");
  redirect("/admin/livreurs");
}

export type DocUploadState = { ok: boolean; error?: string } | null;

/** Admin : ajoute la pièce d'identité d'un livreur créé avant l'obligation (ou la remplace). */
export async function uploadLivreurDocuments(id: string, _prev: DocUploadState, formData: FormData): Promise<DocUploadState> {
  await requireAdmin("livraison");
  const kind = String(formData.get("idType") ?? "").toUpperCase();
  const idNumber = String(formData.get("idNumber") ?? "").trim().toUpperCase().slice(0, 40);
  if (!["CNI", "PASSEPORT", "PERMIS"].includes(kind)) return { ok: false, error: "Choisissez le type de pièce." };
  if (idNumber.replace(/[^0-9A-Z]/g, "").length < 5) return { ok: false, error: "Indiquez le numéro de la pièce." };
  const recto = await readDoc(formData.get("idRecto"), "RECTO", "du recto");
  if (typeof recto === "string") return { ok: false, error: recto };
  const docs: Doc[] = [recto];
  if (needsVerso(kind)) {
    const verso = await readDoc(formData.get("idVerso"), "VERSO", "du verso");
    if (typeof verso === "string") return { ok: false, error: verso };
    docs.push(verso);
  }
  await prisma.$transaction([
    prisma.livreurDocument.deleteMany({ where: { livreurId: id } }),
    prisma.livreurDocument.createMany({ data: docs.map((doc) => ({ livreurId: id, kind, side: doc.side, mime: doc.mime, size: doc.data.byteLength, data: doc.data })) }),
    prisma.livreur.update({ where: { id }, data: { idType: kind, idNumber, docsVerifiedAt: new Date() } }),
  ]);
  revalidatePath("/admin/livreurs");
  revalidatePath(`/admin/livreurs/${id}/modifier`);
  return { ok: true };
}
