"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Loader2, SendHorizontal, Sparkles, RotateCcw } from "lucide-react";
import { askAssistant } from "@/lib/actions/assistant";
import type { ChatMessage } from "@/lib/ai/assistant";

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

const STORAGE_KEY = "jamaal_assistant_v1";

/** Rendu Markdown minimal et sûr : gras, liens internes, listes à puces, paragraphes. */
function renderInline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) {
      const href = m[2];
      out.push(
        href.startsWith("/") && !href.startsWith("//") ? (
          <Link key={`${key}-${i++}`} href={href} className="font-medium text-[#8a5a44] underline underline-offset-2">
            {m[1]}
          </Link>
        ) : (
          m[1]
        )
      );
    } else {
      out.push(<strong key={`${key}-${i++}`}>{m[3]}</strong>);
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) {
      const items = list;
      blocks.push(
        <ul key={`ul-${blocks.length}`} className="my-1 list-disc space-y-0.5 pl-5">
          {items.map((l, j) => (
            <li key={j}>{renderInline(l, `li-${blocks.length}-${j}`)}</li>
          ))}
        </ul>
      );
      list = [];
    }
  };
  text.split("\n").forEach((raw, n) => {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (bullet) return void list.push(bullet[1]);
    flush();
    if (!line.trim()) return;
    const heading = line.match(/^#{1,4}\s+(.*)$/);
    blocks.push(
      <p key={`p-${n}`} className={heading ? "mt-2 font-semibold" : "my-1"}>
        {renderInline(heading ? heading[1] : line, `p-${n}`)}
      </p>
    );
  });
  flush();
  return <>{blocks.map((b, i) => <Fragment key={i}>{b}</Fragment>)}</>;
}

export function AssistantChat({ role, enabled }: { role: string; enabled: boolean }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Conversation conservée dans l'onglet (confort uniquement).
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
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  async function send(question: string) {
    const q = question.trim();
    if (!q || loading) return;
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

  const suggestions = SUGGESTIONS[role] ?? SUGGESTIONS.LIVREUR;

  return (
    <div className="flex h-[calc(100dvh-11rem)] min-h-[420px] flex-col rounded-2xl border border-stone-200 bg-white shadow-sm">
      <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
        {!messages.length && (
          <div className="mx-auto max-w-xl py-6 text-center">
            <Sparkles className="mx-auto mb-3 text-[#8a5a44]" size={28} />
            <p className="text-lg font-semibold text-navy">Que voulez-vous savoir ?</p>
            <p className="mt-1 text-sm text-stone-500">
              Produits, stock, commandes, clients, ventes ou fonctionnement de l&apos;application : l&apos;assistant
              cherche dans vos données et vous répond.
            </p>
            {enabled && (
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-left text-xs text-stone-700 hover:border-[#8a5a44] hover:text-[#8a5a44]"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                m.role === "user"
                  ? "max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-navy px-4 py-2.5 text-sm text-white"
                  : "max-w-[90%] rounded-2xl rounded-bl-sm bg-stone-100 px-4 py-2.5 text-sm leading-relaxed text-stone-800"
              }
            >
              {m.role === "user" ? m.text : <Markdown text={m.text} />}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-stone-500">
            <Loader2 size={16} className="animate-spin" /> Recherche dans vos données…
          </div>
        )}
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-end gap-2 border-t border-stone-200 p-3"
      >
        {messages.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setMessages([]);
              setError(null);
            }}
            title="Nouvelle conversation"
            className="rounded-xl p-2.5 text-stone-500 hover:bg-stone-100"
          >
            <RotateCcw size={18} />
          </button>
        )}
        <textarea
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
          className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border border-stone-200 px-3 py-2.5 text-sm outline-none focus:border-[#8a5a44] disabled:bg-stone-50"
        />
        <button
          type="submit"
          disabled={!enabled || loading || !input.trim()}
          className="rounded-xl bg-navy p-3 text-white disabled:opacity-40"
          aria-label="Envoyer"
        >
          <SendHorizontal size={18} />
        </button>
      </form>
    </div>
  );
}
