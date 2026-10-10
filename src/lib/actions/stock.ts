"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "./auth-guard";
import { logActivity } from "@/lib/activity-log";
import { moveStock, setStock, sendLowStockAlerts, StockError, MOVEMENT_LABELS, type LowStockAlert, type MovementKind } from "@/lib/stock";
import { findByCode } from "@/lib/inventory-report";
import { invalidateSearchIndex } from "@/lib/search-index";

export type StockActionState = { ok: boolean; message?: string; error?: string; lines?: string[] };

const MANUAL_KINDS: MovementKind[] = ["RECEPTION", "INVENTAIRE", "PERTE", "RETOUR", "AJUSTEMENT"];

function refresh() {
  revalidatePath("/admin/stocks");
  revalidatePath("/admin/stocks/mouvements");
  revalidatePath("/admin/produits");
  invalidateSearchIndex();
}

async function refFor(productId: string, variantId: string | null) {
  if (variantId) {
    const v = await prisma.productVariant.findUnique({ where: { id: variantId }, select: { productId: true, volumeLabel: true } });
    if (!v || v.productId !== productId) return null;
    return { productId, variantId, label: v.volumeLabel };
  }
  const p = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
  return p ? { productId, variantId: null, label: "Format unique" } : null;
}

/** Mouvement sur une ligne du tableau : entrée, sortie ou stock compté (inventaire). */
export async function adjustStockAction(_prev: StockActionState, formData: FormData): Promise<StockActionState> {
  const session = await requireAdmin();
  const productId = String(formData.get("productId") ?? "");
  const variantId = String(formData.get("variantId") ?? "") || null;
  const mode = String(formData.get("mode") ?? "in");
  const qty = Number(String(formData.get("qty") ?? "").replace(/\s/g, ""));
  const kind = (MANUAL_KINDS.includes(formData.get("kind") as MovementKind) ? formData.get("kind") : "AJUSTEMENT") as MovementKind;
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 180);
  const reference = String(formData.get("reference") ?? "").trim().slice(0, 80) || null;
  if (!Number.isInteger(qty) || qty < 0 || (mode !== "set" && qty === 0)) return { ok: false, error: "Saisissez une quantité entière." };
  if (mode !== "set" && kind === "AJUSTEMENT" && !reason) return { ok: false, error: "Précisez le motif de l'ajustement." };

  const ref = await refFor(productId, variantId);
  if (!ref) return { ok: false, error: "Article introuvable." };
  const userId = session.user?.id ?? null;
  let alerts: LowStockAlert[] = [];
  try {
    const r = await prisma.$transaction(async (tx) => {
      const res =
        mode === "set"
          ? await setStock(tx, ref, qty, { userId, reason: reason || MOVEMENT_LABELS.INVENTAIRE, reference })
          : await moveStock(tx, ref, mode === "out" ? -qty : qty, { kind: mode === "set" ? "INVENTAIRE" : kind, userId, reason: reason || undefined, reference, strict: true });
      return res;
    });
    if (r.crossed) {
      const name = (await prisma.product.findUnique({ where: { id: productId }, select: { name: true } }))?.name ?? "";
      alerts = [{ name: `${name}${variantId ? ` — ${ref.label}` : ""}`, newStock: r.nextStock }];
    }
    await sendLowStockAlerts(alerts);
    await logActivity(session, `Stock ${ref.label} : ${r.previousStock} → ${r.nextStock}`, "Product", productId);
    refresh();
    return { ok: true, message: `${ref.label} : ${r.previousStock} → ${r.nextStock}` };
  } catch (e) {
    return { ok: false, error: e instanceof StockError ? e.message.replace(/^./, (c) => c.toUpperCase()) : "Mouvement impossible." };
  }
}

/** Seuil d'alerte d'une ligne. */
export async function updateThresholdAction(_prev: StockActionState, formData: FormData): Promise<StockActionState> {
  await requireAdmin();
  const productId = String(formData.get("productId") ?? "");
  const variantId = String(formData.get("variantId") ?? "") || null;
  const threshold = Number(formData.get("threshold"));
  if (!Number.isInteger(threshold) || threshold < 0 || threshold > 100_000) return { ok: false, error: "Seuil invalide." };
  if (variantId) await prisma.productVariant.updateMany({ where: { id: variantId, productId }, data: { lowStockThreshold: threshold } });
  else await prisma.product.update({ where: { id: productId }, data: { lowStockThreshold: threshold } });
  refresh();
  return { ok: true, message: "Seuil enregistré." };
}

/**
 * Saisie en lot (bon de réception ou inventaire) : une ligne par article, « CODE QUANTITÉ ».
 * Toutes les lignes sont vérifiées d'abord ; rien n'est enregistré s'il y a une erreur.
 */
export async function batchStockAction(_prev: StockActionState, formData: FormData): Promise<StockActionState> {
  const session = await requireAdmin();
  const mode = formData.get("mode") === "INVENTAIRE" ? "INVENTAIRE" : "RECEPTION";
  const reference = String(formData.get("reference") ?? "").trim().slice(0, 80) || null;
  const raw = String(formData.get("lines") ?? "");
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return { ok: false, error: "Saisissez au moins une ligne « CODE QUANTITÉ »." };
  if (lines.length > 500) return { ok: false, error: "500 lignes au maximum par saisie." };

  const parsed: { ref: { productId: string; variantId: string | null; label: string }; name: string; qty: number; line: string }[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const [i, line] of lines.entries()) {
    const m = line.match(/^(.+?)[\s;,\t:=x×]+(-?\d+)\s*$/i);
    if (!m) {
      errors.push(`Ligne ${i + 1} « ${line} » : format attendu « CODE QUANTITÉ » (ex. 301M 12).`);
      continue;
    }
    const qty = Number(m[2]);
    if (qty < 0 || (mode === "RECEPTION" && qty === 0)) {
      errors.push(`Ligne ${i + 1} « ${line} » : quantité invalide.`);
      continue;
    }
    const found = await findByCode(m[1]);
    if (!found) {
      errors.push(`Ligne ${i + 1} « ${line} » : code inconnu (ou plusieurs articles portent ce code).`);
      continue;
    }
    const key = `${found.productId}:${found.variantId ?? ""}`;
    if (seen.has(key)) {
      errors.push(`Ligne ${i + 1} « ${line} » : article déjà saisi plus haut.`);
      continue;
    }
    seen.add(key);
    parsed.push({ ref: { productId: found.productId, variantId: found.variantId, label: found.label }, name: found.name, qty, line });
  }
  if (errors.length) return { ok: false, error: `${errors.length} ligne(s) à corriger, rien n'a été enregistré.`, lines: errors };

  const userId = session.user?.id ?? null;
  const summary: string[] = [];
  const alerts: LowStockAlert[] = [];
  try {
    await prisma.$transaction(
      async (tx) => {
        for (const p of parsed) {
          const r =
            mode === "INVENTAIRE"
              ? await setStock(tx, p.ref, p.qty, { userId, reference, reason: `Inventaire${reference ? ` · ${reference}` : ""}` })
              : await moveStock(tx, p.ref, p.qty, { kind: "RECEPTION", userId, reference, reason: `Réception${reference ? ` · ${reference}` : ""}` });
          summary.push(`${p.name} (${p.ref.label}) : ${r.previousStock} → ${r.nextStock}`);
          if (r.crossed) alerts.push({ name: `${p.name} — ${p.ref.label}`, newStock: r.nextStock });
        }
      },
      { timeout: 60_000 }
    );
  } catch (e) {
    return { ok: false, error: e instanceof StockError ? e.message : "Enregistrement impossible, réessayez." };
  }
  await sendLowStockAlerts(alerts);
  await logActivity(session, `${mode === "INVENTAIRE" ? "Inventaire" : "Réception"} de ${parsed.length} article(s)${reference ? ` (${reference})` : ""}`, "Product");
  refresh();
  return { ok: true, message: `${parsed.length} article(s) enregistré(s).`, lines: summary };
}

/**
 * Remise à zéro de tout le stock (avant la saisie des marchandises réellement reçues).
 * Chaque format non nul reçoit un mouvement « Inventaire » tracé, puis tous les stocks passent à 0.
 */
export async function resetAllStockAction(_prev: StockActionState, formData: FormData): Promise<StockActionState> {
  const session = await requireAdmin();
  if (String(formData.get("confirm") ?? "").trim().toUpperCase() !== "ZERO") {
    return { ok: false, error: "Tapez ZERO dans la case de confirmation pour remettre tout le stock à zéro." };
  }
  const reference = String(formData.get("reference") ?? "").trim().slice(0, 80) || "Remise à zéro du stock";
  const userId = session.user?.id ?? null;
  let formats = 0, units = 0;
  try {
    await prisma.$transaction(
      async (tx) => {
        const variants = await tx.productVariant.findMany({ where: { stock: { not: 0 } }, select: { id: true, productId: true, stock: true } });
        // Produits à format unique : le stock est porté par le produit lui-même.
        const singles = await tx.product.findMany({ where: { stock: { not: 0 }, variants: { none: {} } }, select: { id: true, stock: true } });
        const rows = [
          ...variants.map((v) => ({ productId: v.productId, variantId: v.id as string | null, stock: v.stock })),
          ...singles.map((p) => ({ productId: p.id, variantId: null as string | null, stock: p.stock })),
        ];
        if (rows.length) {
          await tx.stockMovement.createMany({
            data: rows.map((r) => ({ productId: r.productId, variantId: r.variantId, userId, delta: -r.stock, previousStock: r.stock, nextStock: 0, kind: "INVENTAIRE", reference, reason: `Remise à zéro · ${reference}`.slice(0, 200) })),
          });
        }
        await tx.productVariant.updateMany({ where: { stock: { not: 0 } }, data: { stock: 0 } });
        await tx.product.updateMany({ where: { stock: { not: 0 } }, data: { stock: 0 } });
        formats = rows.length;
        units = rows.reduce((s, r) => s + Math.max(0, r.stock), 0);
      },
      { timeout: 120_000 }
    );
  } catch (e) {
    console.error("[stock] remise à zéro", e);
    return { ok: false, error: "Remise à zéro impossible, réessayez." };
  }
  await logActivity(session, `Remise à zéro de tout le stock : ${formats} format(s), ${units} unité(s) (${reference})`, "Product");
  refresh();
  return { ok: true, message: formats ? `Stock remis à zéro : ${formats} format(s), ${units.toLocaleString("fr-FR")} unité(s) retirée(s). Saisissez maintenant les produits reçus ci-dessus (mode « Réception de marchandise »).` : "Le stock était déjà à zéro." };
}
