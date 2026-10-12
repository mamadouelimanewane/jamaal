"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ArrowDownToLine, ArrowUpToLine, Expand, Loader2, RotateCcw, SendHorizontal, Sparkles, X } from "lucide-react";
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
  headerExtra,
}: {
  role: string;
  enabled: boolean;
  variant: "page" | "floating";
  onClose?: () => void;
  headerExtra?: ReactNode;
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
          <p className="truncate font-serif-display text-lg font-semibold leading-tight">Assistant JAMAAL</p>
          <p className="truncate text-xs text-white/70">{SUBTITLE[role] ?? SUBTITLE.LIVREUR}</p>
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
            {headerExtra}
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
/** Position de la bulle : côté de l'écran et hauteur (fraction de la hauteur de la fenêtre), gardée sur l'appareil. */
type BubblePos = { side: "left" | "right"; y: number };
const POS_KEY = "jamaal_assistant_bulle_v1";
const DEFAULT_POS: BubblePos = { side: "right", y: 0.9 };
const BUBBLE = 60;
const MARGIN = 16;
const clampY = (y: number) => Math.min(0.95, Math.max(0.05, y));

function readPos(): BubblePos {
  try {
    const p = JSON.parse(localStorage.getItem(POS_KEY) ?? "null") as BubblePos | null;
    if (p && (p.side === "left" || p.side === "right") && typeof p.y === "number") return { side: p.side, y: clampY(p.y) };
  } catch {}
  return DEFAULT_POS;
}

/**
 * Bulle IA flottante, présente sur toutes les pages du back-office. Elle se déplace à la main
 * (glisser, à la souris ou au doigt ; elle se range contre le bord gauche ou droit le plus proche),
 * avec les flèches du clavier, ou avec le bouton « en haut / en bas » de la fenêtre de discussion.
 * La fenêtre s'ouvre du côté de la bulle : en haut si la bulle est en haut, en bas sinon.
 */
export function AssistantLauncher({ role }: { role: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<BubblePos>(DEFAULT_POS);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [viewH, setViewH] = useState(800);
  const start = useRef<{ px: number; py: number; moved: boolean } | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture unique du stockage du navigateur
    setPos(readPos());
    const onResize = () => setViewH(window.innerHeight);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const save = useCallback((p: BubblePos) => {
    setPos(p);
    try {
      localStorage.setItem(POS_KEY, JSON.stringify(p));
    } catch {}
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (pathname === PAGE) return null;

  const atTop = pos.y < 0.5;
  const top = Math.min(viewH - BUBBLE - MARGIN, Math.max(MARGIN, pos.y * viewH - BUBBLE / 2));

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { px: e.clientX, py: e.clientY, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const s = start.current;
    if (!s) return;
    if (!s.moved && Math.hypot(e.clientX - s.px, e.clientY - s.py) < 6) return;
    s.moved = true;
    setDrag({ x: e.clientX, y: e.clientY });
  };
  const onPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const s = start.current;
    start.current = null;
    setDrag(null);
    if (!s) return;
    if (!s.moved) {
      setOpen(true);
      return;
    }
    save({ side: e.clientX < window.innerWidth / 2 ? "left" : "right", y: clampY(e.clientY / window.innerHeight) });
  };
  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const moves: Record<string, () => BubblePos> = {
      ArrowUp: () => ({ ...pos, y: clampY(pos.y - 0.1) }),
      ArrowDown: () => ({ ...pos, y: clampY(pos.y + 0.1) }),
      ArrowLeft: () => ({ ...pos, side: "left" }),
      ArrowRight: () => ({ ...pos, side: "right" }),
    };
    if (moves[e.key]) {
      e.preventDefault();
      save(moves[e.key]());
    }
  };

  const bubbleStyle: React.CSSProperties = drag
    ? { left: drag.x - BUBBLE / 2, top: drag.y - BUBBLE / 2, transition: "none" }
    : { top, [pos.side]: MARGIN };

  const moveButton = (
    <button
      type="button"
      onClick={() => save({ ...pos, y: atTop ? 0.9 : 0.1 })}
      title={atTop ? "Placer l'assistant en bas" : "Placer l'assistant en haut"}
      aria-label={atTop ? "Placer l'assistant en bas" : "Placer l'assistant en haut"}
      className="rounded-full p-2 text-white/80 hover:bg-white/10"
    >
      {atTop ? <ArrowDownToLine size={17} /> : <ArrowUpToLine size={17} />}
    </button>
  );

  return (
    <>
      {!open && (
        <button
          type="button"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            start.current = null;
            setDrag(null);
          }}
          onKeyDown={onKeyDown}
          style={{ ...bubbleStyle, width: BUBBLE, height: BUBBLE, touchAction: "none" }}
          aria-label="Assistant JAMAAL : cliquez pour poser une question, faites glisser pour déplacer la bulle"
          title="Posez votre question — faites glisser pour déplacer"
          className={`group fixed z-40 flex select-none items-center justify-center rounded-full bg-navy text-white shadow-xl shadow-navy/30 ring-4 ring-white transition-[top,left,right,transform] duration-300 print:hidden ${drag ? "scale-110 cursor-grabbing" : "cursor-grab hover:scale-105"}`}
        >
          <Sparkles size={26} className="text-[#e9c9b9]" />
          <span className="absolute -right-1 -top-1 rounded-full bg-[#e9c9b9] px-1.5 py-0.5 text-[10px] font-bold leading-none text-navy">IA</span>
          {!drag && <span className="pointer-events-none absolute inset-0 animate-ping rounded-full bg-navy/20 [animation-iteration-count:2]" />}
        </button>
      )}
      {open && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label="Assistant JAMAAL"
          className={`fixed inset-x-0 z-50 h-[88dvh] overflow-hidden border border-line bg-white shadow-2xl shadow-navy/20 sm:inset-x-auto sm:h-[min(640px,calc(100dvh-2.5rem))] sm:w-[400px] sm:rounded-3xl ${
            atTop ? "top-0 rounded-b-3xl sm:top-5" : "bottom-0 rounded-t-3xl sm:bottom-5"
          } ${pos.side === "left" ? "sm:left-5" : "sm:right-5"}`}
        >
          <AssistantPanel role={role} enabled variant="floating" onClose={() => setOpen(false)} headerExtra={moveButton} />
        </div>
      )}
    </>
  );
}
