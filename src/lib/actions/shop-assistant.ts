"use server";

import { headers } from "next/headers";
import { clientIpFromHeaders, rateLimit } from "@/lib/rate-limit";
import { geminiConfigured, GeminiError } from "@/lib/ai/gemini";
import { runChat, type ChatMessage } from "@/lib/ai/assistant";
import { runShopTool, SHOP_TOOLS, shopSystemPrompt } from "@/lib/ai/shop-assistant";

export type ShopAssistantResult = { ok: true; text: string } | { ok: false; error: string };

const OFFLINE = "La conseillère virtuelle n'est pas disponible pour le moment : écrivez-nous sur WhatsApp, nous vous répondons vite.";

/** Question d'un visiteur à l'assistant de la boutique (public, limité par adresse IP). */
export async function askShopAssistant(history: ChatMessage[]): Promise<ShopAssistantResult> {
  if (!geminiConfigured()) return { ok: false, error: OFFLINE };
  if (!Array.isArray(history) || !history.length || history.length > 40) return { ok: false, error: "Question vide." };

  const ip = clientIpFromHeaders(await headers());
  const [minute, day] = await Promise.all([
    rateLimit(`shop-assistant:${ip}`, { limit: 12, windowMs: 60_000 }),
    rateLimit(`shop-assistant-day:${ip}`, { limit: 150, windowMs: 86_400_000 }),
  ]);
  if (!minute.ok || !day.ok) {
    return { ok: false, error: `Beaucoup de questions d'affilée : réessayez dans ${(minute.ok ? day : minute).retryAfterSec} s, ou écrivez-nous sur WhatsApp.` };
  }

  try {
    const answer = await runChat({ system: shopSystemPrompt(), tools: SHOP_TOOLS, exec: runShopTool, history, thinking: "minimal" });
    return { ok: true, text: answer.text };
  } catch (e) {
    console.error("[assistant boutique]", e);
    const timeout = e instanceof Error && e.name === "TimeoutError";
    // Service d'IA injoignable, clé refusée ou autre panne : on oriente vers WhatsApp.
    // La référence (code HTTP de Gemini) aide au diagnostic sans rien révéler.
    const ref = e instanceof GeminiError ? e.message.match(/Gemini (\d{3})/)?.[1] : null;
    return { ok: false, error: timeout ? "La réponse prend trop de temps, réessayez." : `${OFFLINE}${ref ? ` (réf. G${ref})` : ""}` };
  }
}
