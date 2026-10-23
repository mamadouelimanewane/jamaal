"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "./auth-guard";
import { generateContent, geminiConfigured, textOf } from "@/lib/ai/gemini";
import { buildForecast, setForecastSettings } from "@/lib/forecast/run";

export async function saveForecastSettings(fd: FormData): Promise<void> {
  await requireAdmin("stocks");
  const n = (k: string) => Math.min(16, Math.max(1, Math.round(Number(fd.get(k)) || 1)));
  await setForecastSettings({ leadWeeks: n("leadWeeks"), coverWeeks: n("coverWeeks") });
  revalidatePath("/admin/stocks/prevision");
}

/** Analyse de l'IA : lecture de la prévision en quelques conseils concrets (achats, ruptures, stock dormant). */
export async function forecastAiNote(): Promise<{ ok: boolean; message?: string; error?: string }> {
  await requireAdmin("stocks", "read");
  if (!geminiConfigured()) return { ok: false, error: "IA non configurée." };
  const f = await buildForecast();
  const fmt = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} F`;
  const brief = [
    `Fêtes à venir : ${f.events.map((e) => `${e.label} dans ${e.weeks} sem. (×${e.uplift})`).join(", ") || "aucune"}.`,
    `Délai Chogan ${f.settings.leadWeeks} sem., couverture ${f.settings.coverWeeks} sem.`,
    `À commander : ${f.totals.units} articles, ${fmt(f.totals.cost)}. Ruptures sur produits vendus : ${f.totals.ruptures}.`,
    `Top commande : ${f.toOrder.slice(0, 12).map((l) => `${l.name} ${l.format} : ${l.order} (rythme ${l.weekly}/sem, stock ${l.stock})`).join(" ; ")}.`,
    `Stock dormant ${fmt(f.totals.dormantValue)} : ${f.dormant.slice(0, 8).map((l) => `${l.name} ${l.format} ${l.dormant} en trop`).join(" ; ")}.`,
  ].join("\n");
  try {
    const reply = await generateContent({
      system: "Tu es l'acheteur d'une boutique de parfums et cosmétiques Chogan au Sénégal. Donne 4 conseils courts et concrets, en français, en puces, à partir des chiffres fournis (priorités de commande, risques de rupture avant les fêtes, stock dormant à écouler par une offre). N'invente aucun chiffre.",
      contents: [{ role: "user", parts: [{ text: brief }] }],
      maxOutputTokens: 600,
      thinking: "low",
      timeoutMs: 25_000,
    });
    const t = textOf(reply).trim();
    return t ? { ok: true, message: t } : { ok: false, error: "Réponse vide." };
  } catch {
    return { ok: false, error: "L'IA n'a pas répondu, réessayez." };
  }
}
