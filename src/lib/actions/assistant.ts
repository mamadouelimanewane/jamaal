"use server";

import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { getAccess } from "@/lib/access";
import { geminiConfigured, GeminiError } from "@/lib/ai/gemini";
import { runAssistant, type ChatMessage } from "@/lib/ai/assistant";
import type { AssistantScope } from "@/lib/ai/assistant-tools";
import { requireStaff } from "./auth-guard";

export type AssistantResult = { ok: true; text: string; toolsUsed: string[] } | { ok: false; error: string };

/** Question à l'assistant IA du back-office (lecture seule, données filtrées selon le rôle). */
export async function askAssistant(history: ChatMessage[]): Promise<AssistantResult> {
  const session = await requireStaff();
  const userId = session.user?.id;
  const role = session.user?.role;
  if (!userId || (role !== "ADMIN" && role !== "CONSULTANT" && role !== "LIVREUR")) return { ok: false, error: "Session invalide." };
  // L'assistant d'administration voit toutes les données : il est réservé à l'administrateur complet (sans profil restreint).
  if (role === "ADMIN" && (await getAccess(userId))?.perms) return { ok: false, error: "L'assistant d'administration est réservé à l'administrateur principal." };
  if (!geminiConfigured()) return { ok: false, error: "L'assistant n'est pas encore activé : la clé GOOGLE_AI_API_KEY manque sur le serveur." };
  if (!Array.isArray(history) || !history.length) return { ok: false, error: "Question vide." };

  const limited = await rateLimit(`assistant:${userId}`, { limit: 20, windowMs: 60_000 });
  if (!limited.ok) return { ok: false, error: `Trop de questions d'affilée. Réessayez dans ${limited.retryAfterSec} s.` };

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { consultantId: true, livreurId: true } });
  const scope: AssistantScope = { role, userId, consultantId: user?.consultantId ?? null, livreurId: user?.livreurId ?? null };

  try {
    const answer = await runAssistant(scope, history);
    return { ok: true, ...answer };
  } catch (e) {
    console.error("[assistant]", e);
    const timeout = e instanceof Error && e.name === "TimeoutError";
    return {
      ok: false,
      error: timeout
        ? "L'assistant met trop de temps à répondre, réessayez."
        : e instanceof GeminiError
          ? "Le service d'IA ne répond pas pour le moment, réessayez dans un instant."
          : "Une erreur est survenue, réessayez.",
    };
  }
}
