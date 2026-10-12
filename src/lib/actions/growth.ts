"use server";

/**
 * Actions des fonctionnalités de croissance : automatisations, offres de fêtes, défis, quiz de
 * formation, avis clients avec photo, veille des prix Chogan, anniversaire des clients.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireConsultantProfile } from "./auth-guard";
import { backWithError } from "@/lib/form-error";
import { logActivity } from "@/lib/activity-log";
import { AUTOMATIONS, setAutomation, type AutomationId } from "@/lib/automation-settings";
import { runDailyJobs } from "@/lib/automation/daily";
import { siteBaseUrl } from "@/lib/site-url";
import { slugify } from "@/lib/ref";
import { getBusinessModel } from "@/lib/business-model-store";
import { salePriceFromPublic } from "@/lib/business-model";
import { QUIZZES, scoreQuiz } from "@/data/quiz-formation";
import { checkReviewToken } from "@/lib/review-token";
import { clientIpFromHeaders, rateLimit } from "@/lib/rate-limit";
import { birthdayKey } from "@/lib/birthday";

const text = (f: FormData, k: string, max = 200) => String(f.get(k) ?? "").trim().slice(0, max);
const intOf = (f: FormData, k: string) => Math.round(Number(String(f.get(k) ?? "").replace(/[\s ]/g, "")) || 0);
const dateOf = (f: FormData, k: string) => {
  const v = text(f, k, 30);
  const d = v ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
};

/* ---------- Automatisations ---------- */

export async function toggleAutomation(id: string, on: boolean) {
  const session = await requireAdmin();
  if (!(id in AUTOMATIONS)) throw new Error("Automatisation inconnue.");
  await setAutomation(id as AutomationId, on);
  await logActivity(session, `${on ? "Activation" : "Arrêt"} : ${AUTOMATIONS[id as AutomationId].label}`, "Setting", id);
  revalidatePath("/admin/automatisations");
}

/** Lance la tâche quotidienne tout de suite (test ou rattrapage) ; rien n'est envoyé deux fois. */
export async function runDailyNow(): Promise<Record<string, unknown>> {
  const session = await requireAdmin();
  const report = await runDailyJobs(siteBaseUrl(), { budgetMs: 45_000 });
  await logActivity(session, "Tâche quotidienne lancée à la main", "Setting", "cron");
  revalidatePath("/admin/automatisations");
  return report;
}

/* ---------- Offres de fêtes ---------- */

export async function saveOffer(formData: FormData) {
  const session = await requireAdmin();
  try {
    const id = text(formData, "id", 40);
    const title = text(formData, "title", 120);
    if (title.length < 3) throw new Error("Titre trop court.");
    const productIds = [...new Set(formData.getAll("productIds").map(String).filter(Boolean))].slice(0, 12);
    if (productIds.length < 2) throw new Error("Choisissez au moins 2 produits pour le coffret.");
    const found = await prisma.product.count({ where: { id: { in: productIds } } });
    if (found !== productIds.length) throw new Error("Un produit du coffret n'existe plus.");
    const packPrice = intOf(formData, "packPrice");
    if (packPrice < 500) throw new Error("Indiquez le prix du coffret (FCFA).");
    const startsAt = dateOf(formData, "startsAt");
    const endsAt = dateOf(formData, "endsAt");
    if (!startsAt || !endsAt || endsAt <= startsAt) throw new Error("Dates de début et de fin invalides.");
    endsAt.setHours(23, 59, 59, 0);
    const data = {
      title,
      occasion: text(formData, "occasion", 60) || null,
      description: text(formData, "description", 1500),
      image: text(formData, "image", 500) || null,
      productIds,
      packPrice,
      startsAt,
      endsAt,
      active: formData.get("active") === "on",
    };
    if (data.image && !/^https:\/\//.test(data.image) && !data.image.startsWith("/")) throw new Error("Adresse d'image invalide.");
    if (id) await prisma.offer.update({ where: { id }, data });
    else {
      const base = slugify(title).slice(0, 50) || "offre";
      let slug = base;
      for (let i = 2; await prisma.offer.findUnique({ where: { slug }, select: { id: true } }); i++) slug = `${base}-${i}`;
      await prisma.offer.create({ data: { ...data, slug } });
    }
    await logActivity(session, `${id ? "Modification" : "Création"} de l'offre ${title}`, "Offer", id || title);
  } catch (e) {
    await backWithError(e, "/admin/offres");
  }
  revalidatePath("/admin/offres");
  revalidatePath("/offres");
  revalidatePath("/");
  redirect("/admin/offres");
}

export async function deleteOffer(id: string) {
  const session = await requireAdmin();
  await prisma.offer.delete({ where: { id } });
  await logActivity(session, "Suppression d'une offre", "Offer", id);
  revalidatePath("/admin/offres");
  revalidatePath("/offres");
  revalidatePath("/");
}

/* ---------- Défis ---------- */

export async function saveChallenge(formData: FormData) {
  const session = await requireAdmin();
  try {
    const id = text(formData, "id", 40);
    const title = text(formData, "title", 120);
    if (title.length < 3) throw new Error("Titre trop court.");
    const metric = text(formData, "metric") === "CA" ? "CA" : "VENTES";
    const target = intOf(formData, "target");
    const bonus = intOf(formData, "bonus");
    if (target < 1) throw new Error("Objectif invalide.");
    if (bonus < 0 || bonus > 5_000_000) throw new Error("Bonus invalide.");
    const startsAt = dateOf(formData, "startsAt");
    const endsAt = dateOf(formData, "endsAt");
    if (!startsAt || !endsAt || endsAt <= startsAt) throw new Error("Dates de début et de fin invalides.");
    endsAt.setHours(23, 59, 59, 0);
    const data = { title, description: text(formData, "description", 1000), metric, target, bonus, startsAt, endsAt, active: formData.get("active") === "on" };
    if (id) {
      const current = await prisma.challenge.findUnique({ where: { id }, select: { awardedAt: true } });
      if (current?.awardedAt) throw new Error("Ce défi est clôturé : les bonus ont été versés.");
      await prisma.challenge.update({ where: { id }, data });
    } else {
      await prisma.challenge.create({ data });
      const resellers = await prisma.user.findMany({ where: { role: "CONSULTANT" }, select: { id: true } });
      if (resellers.length && data.active) {
        await prisma.notification.createMany({ data: resellers.map((u) => ({ userId: u.id, title: "Nouveau défi JAMAAL 🏆", message: `${title} : ${bonus.toLocaleString("fr-FR")} FCFA de bonus` })) });
      }
    }
    await logActivity(session, `${id ? "Modification" : "Création"} du défi ${title}`, "Challenge", id || title);
  } catch (e) {
    await backWithError(e, "/admin/defis");
  }
  revalidatePath("/admin/defis");
  revalidatePath("/admin/mes-defis");
  redirect("/admin/defis");
}

export async function deleteChallenge(id: string) {
  const session = await requireAdmin();
  const ch = await prisma.challenge.findUnique({ where: { id }, select: { awardedAt: true } });
  if (ch?.awardedAt) throw new Error("Défi clôturé : il reste dans l'historique.");
  await prisma.challenge.delete({ where: { id } });
  await logActivity(session, "Suppression d'un défi", "Challenge", id);
  revalidatePath("/admin/defis");
  revalidatePath("/admin/mes-defis");
}

/* ---------- Revendeur : relances et quiz ---------- */

export async function setMyAutoRelances(on: boolean) {
  const { consultant } = await requireConsultantProfile();
  await prisma.consultant.update({ where: { id: consultant.id }, data: { autoRelances: on } });
  revalidatePath("/admin/mon-profil");
}

export async function submitQuiz(quizId: string, answers: number[]): Promise<{ score: number; total: number; corrections: { question: string; good: string; explanation: string; ok: boolean }[] }> {
  const { consultant } = await requireConsultantProfile();
  const quiz = QUIZZES.find((q) => q.id === quizId);
  if (!quiz) throw new Error("Quiz introuvable.");
  const result = scoreQuiz(quiz, Array.isArray(answers) ? answers.map((a) => Number(a)) : []);
  const prev = await prisma.quizResult.findUnique({ where: { consultantId_quizId: { consultantId: consultant.id, quizId } } });
  if (!prev) await prisma.quizResult.create({ data: { consultantId: consultant.id, quizId, score: result.score, total: result.total } });
  else if (result.score > prev.score) await prisma.quizResult.update({ where: { id: prev.id }, data: { score: result.score, total: result.total } });
  revalidatePath("/admin/formation");
  return result;
}

/* ---------- Avis clients avec photo ---------- */

export type ReviewFormState = { ok: boolean; error?: string };

export async function submitOrderReviews(_prev: ReviewFormState, formData: FormData): Promise<ReviewFormState> {
  const orderId = text(formData, "orderId", 40);
  const token = text(formData, "t", 40);
  if (!orderId || !checkReviewToken(orderId, token)) return { ok: false, error: "Lien d'avis invalide." };
  const limited = await rateLimit(`avis-commande:${clientIpFromHeaders(await headers())}`, { limit: 10, windowMs: 3_600_000 });
  if (!limited.ok) return { ok: false, error: "Trop d'envois, réessayez plus tard." };
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { customerName: true, status: true, items: { select: { productId: true } } } });
  if (!order || order.status === "ANNULEE") return { ok: false, error: "Commande introuvable." };
  if (await prisma.review.count({ where: { orderId } })) return { ok: false, error: "Merci, votre avis a déjà été enregistré." };

  const authorName = (text(formData, "authorName", 80) || order.customerName.split(/\s+/)[0] || "Client JAMAAL").slice(0, 80);
  let photo: string | null = null;
  const file = formData.get("photo");
  if (file instanceof File && file.size > 0) {
    if (!file.type.startsWith("image/")) return { ok: false, error: "La photo doit être une image." };
    if (file.size > 4 * 1024 * 1024) return { ok: false, error: "Photo trop lourde (4 Mo au plus)." };
    try {
      photo = (await put(`avis/${orderId}-${Date.now()}.${file.type.split("/")[1]?.replace(/[^a-z0-9]/g, "") || "jpg"}`, file, { access: "public", addRandomSuffix: true, contentType: file.type })).url;
    } catch (e) {
      console.error("[avis] photo", e);
      return { ok: false, error: "La photo n'a pas pu être envoyée, réessayez sans photo." };
    }
  }

  const productIds = [...new Set(order.items.map((i) => i.productId).filter((x): x is string => !!x))];
  let created = 0;
  for (const productId of productIds) {
    const rating = Math.round(Number(formData.get(`rating-${productId}`) ?? 0));
    const comment = text(formData, `comment-${productId}`, 2000);
    if (rating < 1 || rating > 5) continue;
    await prisma.review.create({ data: { productId, orderId, authorName, rating, comment: comment || "—", photo: created === 0 ? photo : null } });
    created++;
  }
  if (!created) return { ok: false, error: "Donnez au moins une note (étoiles)." };
  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  if (admins.length) await prisma.notification.createMany({ data: admins.map((a) => ({ userId: a.id, title: "Nouvel avis client", message: `${authorName} a donné son avis${photo ? " avec une photo" : ""}. À valider dans Avis clients.` })) });
  revalidatePath("/admin/avis");
  return { ok: true };
}

/* ---------- Veille des prix Chogan ---------- */

/** Applique un nouveau prix public Chogan : prix public et prix de vente JAMAAL recalculé. */
export async function applyChoganPrice(changeId: string) {
  const session = await requireAdmin();
  const change = await prisma.choganPriceChange.findUnique({ where: { id: changeId } });
  if (!change) return;
  const model = await getBusinessModel();
  const product = await prisma.product.findUnique({ where: { id: change.productId }, select: { volumes: true, regularPrice: true } });
  if (product) {
    const regularPrice = salePriceFromPublic(change.newPublic, model);
    // Produit à format unique : le prix du format suit. Plusieurs formats : à revoir dans la fiche.
    const volumes = (product.volumes as { label: string; price: number }[] | null) ?? null;
    const single = volumes && volumes.length === 1 ? [{ ...volumes[0], price: regularPrice }] : undefined;
    await prisma.product.update({ where: { id: change.productId }, data: { publicPrice: change.newPublic, regularPrice, ...(single ? { volumes: single } : {}) } });
  }
  await prisma.choganPriceChange.update({ where: { id: changeId }, data: { seen: true } });
  await logActivity(session, `Prix Chogan appliqué : ${change.name}`, "Product", change.productId);
  revalidatePath("/admin/stocks/commande-chogan");
  revalidatePath("/admin/produits");
}

export async function dismissChoganPrice(changeId: string) {
  await requireAdmin();
  await prisma.choganPriceChange.update({ where: { id: changeId }, data: { seen: true } });
  revalidatePath("/admin/stocks/commande-chogan");
}

/* ---------- Anniversaire d'un client ---------- */

export async function setCustomerBirthday(customerId: string, formData: FormData) {
  await requireAdmin();
  try {
    const raw = text(formData, "birthday", 10);
    const birthday = raw ? birthdayKey(raw) : null;
    if (raw && !birthday) throw new Error("Date d'anniversaire invalide (jour et mois).");
    await prisma.customer.update({ where: { id: customerId }, data: { birthday } });
  } catch (e) {
    await backWithError(e, `/admin/clients/${customerId}`);
  }
  revalidatePath(`/admin/clients/${customerId}`);
}
