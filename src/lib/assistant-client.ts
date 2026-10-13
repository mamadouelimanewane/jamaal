import type { ChatMessage } from "@/lib/ai/assistant";

export type AssistantReply = { ok: true; text: string } | { ok: false; error: string };

/**
 * Envoie la conversation à l'assistant (route /api/assistant/…). Un réseau mobile qui coupe
 * ou un serveur momentanément indisponible : une seconde tentative automatique, puis un
 * message clair.
 */
export async function askAssistantApi(path: string, history: ChatMessage[], fetchImpl: typeof fetch = fetch): Promise<AssistantReply> {
  let lastStatus = 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetchImpl(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ history }) });
      lastStatus = res.status;
      if (res.ok) {
        const data = (await res.json()) as AssistantReply;
        if (data && typeof data === "object" && "ok" in data) return data;
      }
      if (res.status === 429) return { ok: false, error: "Beaucoup de questions d'affilée : patientez un instant." };
      if (res.status < 500) break;
    } catch {
      // coupure réseau : on réessaie une fois
    }
    if (attempt === 0) await new Promise((r) => setTimeout(r, 1200));
  }
  return { ok: false, error: lastStatus === 504 ? "La réponse a pris trop de temps, réessayez." : "Connexion perdue, réessayez." };
}
