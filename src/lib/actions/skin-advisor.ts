"use server";

import { headers } from "next/headers";
import { put } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCategories } from "@/lib/db-categories";
import { startingPrice } from "@/lib/reseller-catalog";
import { rateLimit, clientIpFromHeaders } from "@/lib/rate-limit";
import { generateContent, generateImage, textOf, visionConfigured } from "@/lib/ai/gemini";
import { adviceFor, analysisPrompt, isSkincare, mergeRoutine, parseAnalysis, parseAnswers, ruleRoutine, type Analysis, type CatalogItem, type Routine } from "@/lib/skin/advisor";
import { getSkinVisuals, MAX_VISUALS, setSkinVisuals, VISUAL_PROMPTS } from "@/lib/skin/visuals";
import { requireAdmin } from "./auth-guard";

export type SkinResult =
  | { ok: true; routine: Routine; analysis: Analysis | null; advice: string[]; usedPhoto: boolean; note?: string; emptyCatalog: boolean }
  | { ok: false; error: string };

async function skincareCatalog(): Promise<CatalogItem[]> {
  const [rows, categories] = await Promise.all([
    prisma.product.findMany({ select: { id: true, slug: true, name: true, category: true, shortDescription: true, photo: true, regularPrice: true, volumes: true }, orderBy: { reviewCount: "desc" }, take: 2000 }),
    getCategories(),
  ]);
  const labels = new Map(categories.map((c) => [c.slug as string, c.label]));
  return rows
    .map((r) => ({ id: r.id, slug: r.slug, name: r.name, category: r.category, categoryLabel: labels.get(r.category) ?? null, shortDescription: r.shortDescription, photo: r.photo, price: startingPrice(r.regularPrice, r.volumes) }))
    .filter(isSkincare);
}

const TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Analyse : questionnaire seul, ou questionnaire + selfie (IA). La photo n'est jamais enregistrée. */
export async function analyzeSkin(formData: FormData): Promise<SkinResult> {
  const answers = parseAnswers({ skinType: formData.get("skinType"), concerns: formData.getAll("concerns").map(String), sun: formData.get("sun"), age: formData.get("age") });
  const photo = formData.get("photo");
  const hasPhoto = photo instanceof File && photo.size > 0;
  if (!hasPhoto && !answers.skinType) return { ok: false, error: "Ajoutez un selfie ou indiquez votre type de peau." };

  const limited = await rateLimit(`skin:${clientIpFromHeaders(await headers())}`, { limit: 8, windowMs: 3_600_000 });
  if (!limited.ok) return { ok: false, error: "Beaucoup d'analyses depuis votre connexion : réessayez dans une heure." };

  const catalog = await skincareCatalog().catch(() => [] as CatalogItem[]);
  let analysis: Analysis | null = null;
  let note: string | undefined;

  if (hasPhoto) {
    if (!TYPES.includes(photo.type) || photo.size > 4 * 1024 * 1024) return { ok: false, error: "Photo non lisible : prenez un selfie en JPG ou PNG (4 Mo au plus)." };
    if (!visionConfigured()) {
      note = "L'analyse de la photo n'est pas encore activée : votre routine est établie d'après vos réponses.";
    } else {
      try {
        const reply = await generateContent({
          vision: true,
          json: true,
          temperature: 0.3,
          maxOutputTokens: 1800,
          thinking: "low",
          timeoutMs: 45_000,
          contents: [{ role: "user", parts: [{ inlineData: { mimeType: photo.type, data: Buffer.from(await photo.arrayBuffer()).toString("base64") } }, { text: analysisPrompt(answers, catalog) }] }],
        });
        const raw = textOf(reply).replace(/^```(?:json)?\s*|\s*```$/g, "");
        const parsed = parseAnalysis(JSON.parse(raw), new Set(catalog.map((p) => p.id)));
        if (!parsed.ok) return { ok: false, error: `${parsed.reason} Reprenez un selfie de face, en pleine lumière naturelle, sans filtre ni maquillage épais.` };
        analysis = parsed.analysis;
      } catch (e) {
        console.error("[skin-advisor]", e);
        note = "L'analyse de la photo n'a pas abouti : votre routine est établie d'après vos réponses.";
        if (!answers.skinType) return { ok: false, error: "L'analyse de la photo n'a pas abouti. Indiquez votre type de peau pour obtenir votre routine, ou réessayez." };
      }
    }
  }

  const effective = { ...answers, skinType: answers.skinType ?? analysis?.skinType ?? null };
  const routine = mergeRoutine(ruleRoutine(effective, catalog), analysis, catalog);
  const advice = [...new Set([...(analysis?.advice ?? []), ...adviceFor(effective)])].slice(0, 6);
  return { ok: true, routine, analysis, advice, usedPhoto: !!analysis, note, emptyCatalog: catalog.length === 0 };
}

/* ---------- Visuels (administration) ---------- */

export type VisualState = { ok: boolean; message?: string };

export async function generateSkinVisual(presetId: string): Promise<VisualState> {
  await requireAdmin("marketing", "write");
  const preset = VISUAL_PROMPTS.find((p) => p.id === presetId);
  if (!preset) return { ok: false, message: "Modèle de visuel inconnu." };
  if (!process.env.BLOB_READ_WRITE_TOKEN) return { ok: false, message: "Stockage d'images non configuré (BLOB_READ_WRITE_TOKEN)." };
  const current = await getSkinVisuals();
  if (current.length >= MAX_VISUALS) return { ok: false, message: `${MAX_VISUALS} visuels au plus : supprimez-en un d'abord.` };
  try {
    const img = await generateImage(preset.prompt);
    const ext = img.mimeType.includes("jpeg") ? "jpg" : img.mimeType.includes("webp") ? "webp" : "png";
    const blob = await put(`skin-advisor/${preset.id}-${Date.now()}.${ext}`, Buffer.from(img.data), { access: "public", addRandomSuffix: true, contentType: img.mimeType });
    await setSkinVisuals([...current, blob.url]);
    revalidatePath("/skin-advisor");
    revalidatePath("/admin/skin-advisor");
    return { ok: true, message: "Visuel généré et ajouté." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Génération impossible." };
  }
}

export async function addSkinVisual(url: string): Promise<VisualState> {
  await requireAdmin("marketing", "write");
  if (!/^https:\/\//.test(url)) return { ok: false, message: "Adresse invalide." };
  const current = await getSkinVisuals();
  if (current.length >= MAX_VISUALS) return { ok: false, message: `${MAX_VISUALS} visuels au plus : supprimez-en un d'abord.` };
  await setSkinVisuals([...current, url]);
  revalidatePath("/skin-advisor");
  revalidatePath("/admin/skin-advisor");
  return { ok: true, message: "Photo ajoutée." };
}

export async function removeSkinVisual(url: string) {
  await requireAdmin("marketing", "write");
  await setSkinVisuals((await getSkinVisuals()).filter((u) => u !== url));
  revalidatePath("/skin-advisor");
  revalidatePath("/admin/skin-advisor");
}

export async function moveSkinVisualFirst(url: string) {
  await requireAdmin("marketing", "write");
  const list = await getSkinVisuals();
  await setSkinVisuals([url, ...list.filter((u) => u !== url)]);
  revalidatePath("/skin-advisor");
  revalidatePath("/admin/skin-advisor");
}
