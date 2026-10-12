"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Expand, Loader2, RotateCcw, SendHorizontal, Sparkles, X } from "lucide-react";
import { askAssistant } from "@/lib/actions/assistant";
import type { ChatMessage } from "@/lib/ai/assistant";
import { ChatMarkdown } from "@/components/ChatMarkdown";

/**
 * Assistant IA du back-office, au même style que la conseillère du site (ShopAssistant) :
 * en-tête bleu marine, fond crème, bulles blanches, suggestions en pastilles. Deux présentations :
 * la page « Assistant IA » et une bulle flottante disponible sur toutes les pages du back-office.
 * Les deux partagent la même conversation (gardée dans l'onglet).
 */
const SUGGESTIONS: Record<string, string[]> = {
  ADMIN: [
    "Quels produits sont en rupture de stock ?",
    "Que dois-je commander chez Chogan cette semaine ?",
    "Chiffre d'affaires des 30 derniers jours et meilleurs produits",
    "Avez-vous un parfum inspiré de Sauvage en stock ?",
    "Commandes payées non livrées",
    "Meilleurs revendeurs du mois",
  ],
  CONSULTANT: [
    "Avez-vous un parfum inspiré de Baccarat Rouge 540 en stock ?",
    "Mes ventes du mois",
    "Mes meilleurs clients",
    "Quels parfums homme frais sont disponibles ?",
    "Où créer une commande pour un client ?",
  ],
  LIVREUR: ["Mes livraisons en cours", "Où voir mes gains ?"],
};

const WELCOME: Record<string, string> = {
  ADMIN: "Bonjour ! Je consulte le catalogue, le stock, les commandes, les clients et les revendeurs pour vous répondre. Que voulez-vous savoir ?",
  CONSULTANT: "Bonjour ! Je peux vérifier un produit ou un stock, retrouver vos commandes, vos clients et vos ventes, ou vous guider dans l'application. Que voulez-vous savoir ?",
  LIVREUR: "Bonjour ! Je peux retrouver vos livraisons en cours et vos gains. Que voulez-vous savoir ?",
};

const SUBTITLE: Record<string, string> = {
  ADMIN: "Assistante IA · catalogue, stock, ventes, réseau",
  CONSULTANT: "Assistante IA · produits, stock, vos ventes",
  LIVREUR: "Assistante IA · livraisons et gains",
};

const STORAGE_KEY = "jamaal_assistant_v1";
const PAGE = "/admin/assistant";

function readSaved(): ChatMessage[] {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    return saved ? (JSON.parse(saved) as ChatMessage[]) : [];
  } catch {
    return [];
  }
}

export function AssistantPanel({
  role,
  enabled,
  variant,
  onClose,
}: {
  role: string;
  enabled: boolean;
  variant: "page" | "floating";
  onClose?: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Conversation partagée entre la page et la bulle : relue à chaque ouverture.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture unique du stockage du navigateur
    setMessages(readSaved());
    const t = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-30)));
    } catch {}
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  async function send(question: string) {
    const q = question.trim();
    if (!q || loading || !enabled) return;
    const next: ChatMessage[] = [...messages, { role: "user", text: q.slice(0, 1000) }];
    setMessages(next);
    setInput("");
    setError(null);
    setLoading(true);
    try {
      const res = await askAssistant(next);
      if (res.ok) setMessages([...next, { role: "assistant", text: res.text }]);
      else setError(res.error);
    } catch {
      setError("Connexion perdue, réessayez.");
    } finally {
      setLoading(false);
    }
  }

  // Sur téléphone, la bulle couvre la page : on la ferme quand on suit un lien de la réponse.
  const onNavigate = () => {
    if (variant === "floating" && window.matchMedia("(max-width: 639px)").matches) onClose?.();
  };

  const suggestions = SUGGESTIONS[role] ?? SUGGESTIONS.LIVREUR;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-3 bg-navy px-5 py-4 text-white">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10">
          <Sparkles size={20} className="text-[#e9c9b9]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-serif-display text-lg font-semibold leading-tight">Assistant JAMAAL</p>
          <p className="text-xs text-white/70">{SUBTITLE[role] ?? SUBTITLE.LIVREUR}</p>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setMessages([]);
              setError(null);
            }}
            title="Nouvelle conversation"
            aria-label="Nouvelle conversation"
            className="rounded-full p-2 text-white/80 hover:bg-white/10"
          >
            <RotateCcw size={17} />
          </button>
        )}
        {variant === "floating" && (
          <>
            <Link href={PAGE} onClick={onClose} title="Ouvrir en plein écran" aria-label="Ouvrir l'assistant en plein écran" className="hidden rounded-full p-2 text-white/80 hover:bg-white/10 sm:block">
              <Expand size={17} />
            </Link>
            <button type="button" onClick={onClose} aria-label="Fermer l'assistant" className="rounded-full p-2 text-white/80 hover:bg-white/10">
              <X size={20} />
            </button>
          </>
        )}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto bg-cream/40 px-4 py-4 sm:px-5">
        <div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-white px-4 py-3 text-sm leading-relaxed text-navy shadow-sm">{WELCOME[role] ?? WELCOME.LIVREUR}</div>
        {!enabled && (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {role === "ADMIN"
              ? "L'assistant n'est pas activé : ajoutez la variable GOOGLE_AI_API_KEY (clé gratuite sur aistudio.google.com) dans les réglages Vercel, puis redéployez."
              : "L'assistant n'est pas encore activé par l'administrateur."}
          </p>
        )}
        {enabled && !messages.length && (
          <div className="flex flex-wrap gap-2 pt-1">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="rounded-full border border-[#e3d3cd] bg-white px-3 py-1.5 text-left text-xs text-navy transition hover:border-[#9c6254] hover:text-[#9c6254]"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                m.role === "user"
                  ? "max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-navy px-4 py-2.5 text-sm text-white"
                  : "max-w-[92%] rounded-2xl rounded-tl-sm bg-white px-4 py-2.5 text-sm leading-relaxed text-navy shadow-sm"
              }
            >
              {m.role === "user" ? m.text : <ChatMarkdown text={m.text} onNavigate={onNavigate} linkClassName="font-semibold text-[#9c6254] underline underline-offset-2" />}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-navy/60">
            <Loader2 size={16} className="animate-spin" /> L&apos;assistant cherche dans vos données…
          </div>
        )}
        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="border-t border-line bg-white px-3 pb-3 pt-2"
      >
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            maxLength={1000}
            disabled={!enabled}
            placeholder={enabled ? "Posez votre question…" : "Assistant non activé"}
            aria-label="Votre question"
            className="max-h-28 min-h-[44px] flex-1 resize-none rounded-2xl border border-line px-3 py-2.5 text-sm text-navy outline-none focus:border-[#9c6254] disabled:bg-cream/40"
          />
          <button type="submit" disabled={!enabled || loading || !input.trim()} aria-label="Envoyer" className="rounded-2xl bg-navy p-3 text-white disabled:opacity-40">
            <SendHorizontal size={18} />
          </button>
        </div>
        <p className="mt-2 text-center text-[11px] text-navy/55">Assistante IA : elle consulte vos données sans rien modifier. Vérifiez les informations importantes.</p>
      </form>
    </div>
  );
}

/** Bulle flottante « Assistant », sur toutes les pages du back-office sauf la page de l'assistant. */
export function AssistantLauncher({ role }: { role: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (pathname === PAGE) return null;

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Ouvrir l'assistant JAMAAL"
          className="fixed bottom-5 right-5 z-40 flex h-14 items-center gap-2 rounded-full bg-navy pl-4 pr-5 text-white shadow-lg shadow-navy/25 transition hover:scale-105 print:hidden"
        >
          <Sparkles size={20} className="text-[#e9c9b9]" />
          <span className="text-sm font-semibold">Assistant</span>
        </button>
      )}
      {open && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label="Assistant JAMAAL"
          className="fixed inset-x-0 bottom-0 z-50 h-[88dvh] overflow-hidden rounded-t-3xl border border-line bg-white shadow-2xl shadow-navy/20 sm:inset-x-auto sm:bottom-5 sm:right-5 sm:h-[min(640px,calc(100dvh-2.5rem))] sm:w-[400px] sm:rounded-3xl"
        >
          <AssistantPanel role={role} enabled variant="floating" onClose={() => setOpen(false)} />
        </div>
      )}
    </>
  );
}
