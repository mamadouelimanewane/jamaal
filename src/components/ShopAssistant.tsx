"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, RotateCcw, SendHorizontal, Sparkles, X } from "lucide-react";
import { askShopAssistant } from "@/lib/actions/shop-assistant";
import type { ChatMessage } from "@/lib/ai/assistant";
import { ChatMarkdown } from "@/components/ChatMarkdown";
import { WHATSAPP_CONTACTS, whatsappLink } from "@/lib/contact";

const SUGGESTIONS = [
  "Un parfum frais pour homme",
  "Un parfum comme Baccarat Rouge 540",
  "Un cadeau pour une femme qui aime la vanille",
  "Combien coûte la livraison ?",
  "Suivre ma commande",
  "Comment réserver un produit en commande ?",
];

const STORAGE_KEY = "jamaal_conseil_v1";
const WELCOME =
  "Bonjour et bienvenue chez JAMAAL ! Je peux vous conseiller un parfum, vérifier un prix ou une disponibilité, expliquer la livraison et le paiement, ou suivre votre commande. Que cherchez-vous ?";

/** Conseillère virtuelle de la boutique : bulle flottante au-dessus du bouton WhatsApp. */
export function ShopAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Conversation gardée pendant la visite (changement de page compris), confort uniquement.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture unique du stockage du navigateur
      if (saved) setMessages(JSON.parse(saved) as ChatMessage[]);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-30)));
    } catch {}
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading, open]);
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 120);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function send(question: string) {
    const q = question.trim();
    if (!q || loading) return;
    const next: ChatMessage[] = [...messages, { role: "user", text: q.slice(0, 1000) }];
    setMessages(next);
    setInput("");
    setError(null);
    setLoading(true);
    try {
      const res = await askShopAssistant(next);
      if (res.ok) setMessages([...next, { role: "assistant", text: res.text }]);
      else setError(res.error);
    } catch {
      setError("Connexion perdue, réessayez.");
    } finally {
      setLoading(false);
    }
  }

  // Sur téléphone, la fenêtre couvre la page : on la ferme quand le client suit un lien.
  const onNavigate = () => {
    if (window.matchMedia("(max-width: 639px)").matches) setOpen(false);
  };

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Ouvrir la conseillère JAMAAL"
          className="fixed bottom-[5.5rem] right-5 z-40 flex h-14 items-center gap-2 rounded-full bg-navy pl-4 pr-5 text-white shadow-lg shadow-navy/25 transition hover:scale-105"
        >
          <Sparkles size={20} className="text-[#e9c9b9]" />
          <span className="text-sm font-semibold">Conseil</span>
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label="Conseillère virtuelle JAMAAL"
          className="fixed inset-x-0 bottom-0 z-50 flex h-[88dvh] flex-col overflow-hidden rounded-t-3xl border border-line bg-white shadow-2xl shadow-navy/20 sm:inset-x-auto sm:bottom-5 sm:right-5 sm:h-[min(640px,calc(100dvh-2.5rem))] sm:w-[400px] sm:rounded-3xl"
        >
          <div className="flex items-center gap-3 bg-navy px-5 py-4 text-white">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10">
              <Sparkles size={20} className="text-[#e9c9b9]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-serif-display text-lg font-semibold leading-tight">Conseillère JAMAAL</p>
              <p className="text-xs text-white/70">Assistante IA · parfums, commandes, livraison</p>
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
            <button type="button" onClick={() => setOpen(false)} aria-label="Fermer" className="rounded-full p-2 text-white/80 hover:bg-white/10">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto bg-cream/40 px-4 py-4">
            <div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-white px-4 py-3 text-sm leading-relaxed text-navy shadow-sm">{WELCOME}</div>
            {!messages.length && (
              <div className="flex flex-wrap gap-2 pt-1">
                {SUGGESTIONS.map((s) => (
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
                <Loader2 size={16} className="animate-spin" /> La conseillère cherche pour vous…
              </div>
            )}
            {error && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}{" "}
                <a href={whatsappLink(WHATSAPP_CONTACTS[0].number)} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
                  WhatsApp
                </a>
              </p>
            )}
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
                placeholder="Posez votre question…"
                aria-label="Votre question"
                className="max-h-28 min-h-[44px] flex-1 resize-none rounded-2xl border border-line px-3 py-2.5 text-sm text-navy outline-none focus:border-[#9c6254]"
              />
              <button type="submit" disabled={loading || !input.trim()} aria-label="Envoyer" className="rounded-2xl bg-navy p-3 text-white disabled:opacity-40">
                <SendHorizontal size={18} />
              </button>
            </div>
            <p className="mt-2 text-center text-[11px] text-navy/55">
              Assistante IA : vérifiez les informations importantes.{" "}
              <a href={whatsappLink(WHATSAPP_CONTACTS[0].number)} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#1f8f4e] underline">
                Parler à un conseiller
              </a>
            </p>
          </form>
        </div>
      )}
    </>
  );
}
