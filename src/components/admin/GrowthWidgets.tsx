"use client";

import { useMemo, useState, useTransition } from "react";
import { priceLabel } from "@/lib/share-text";
import { findProducts, inspirationLabel } from "@/lib/product-finder";
import { Check, Loader2, Play, Search, X } from "lucide-react";
import { runDailyNow, setMyAutoRelances, submitQuiz, toggleAutomation } from "@/lib/actions/growth";
import type { Quiz } from "@/data/quiz-formation";

/** Interrupteur d'une automatisation (Admin > Automatisations). */
export function AutomationToggle({ id, on, label }: { id: string; on: boolean; label: string }) {
  const [state, setState] = useState(on);
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={state}
      aria-label={label}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const next = !state;
          setState(next);
          try {
            await toggleAutomation(id, next);
          } catch {
            setState(!next);
          }
        })
      }
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition ${state ? "bg-ia" : "bg-navy/20"} disabled:opacity-60`}
    >
      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${state ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

/** Lance la tâche quotidienne maintenant et affiche le compte rendu. */
export function RunDailyButton() {
  const [pending, start] = useTransition();
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            try {
              setReport(await runDailyNow());
            } catch (e) {
              setError(e instanceof Error ? e.message : "Échec");
            }
          })
        }
        className="inline-flex items-center gap-2 rounded-full bg-ia px-4 py-2 text-sm font-semibold text-white hover:bg-ia-dark disabled:opacity-60"
      >
        {pending ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />} {pending ? "En cours (jusqu'à 1 min)…" : "Lancer maintenant"}
      </button>
      {error && <p className="mt-2 text-sm text-rose-dark">{error}</p>}
      {report && (
        <pre className="mt-3 max-h-72 overflow-auto rounded-xl bg-ia-light/60 p-3 text-xs text-navy">{JSON.stringify(report, null, 2)}</pre>
      )}
    </div>
  );
}

export interface PickerProduct {
  id: string;
  name: string;
  code: string | null;
  price: number | null;
  photo?: string | null;
}

/** Choix des produits d'un coffret : recherche + cases à cocher, champs « productIds ». */
export function ProductPicker({ products, initial, max, showValue = true, removeLabel = "Retirer du coffret", onSelectionChange }: { products: PickerProduct[]; initial: string[]; max?: number; showValue?: boolean; removeLabel?: string; onSelectionChange?: (ids: string[]) => void }) {
  const [selected, setSelected] = useState<string[]>(initial);
  const [q, setQ] = useState("");
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const results = q.trim().length >= 2 ? products.filter((p) => norm(`${p.name} ${p.code ?? ""} ${(p as { inspiredBy?: string | null }).inspiredBy ?? ""}`).includes(norm(q.trim()))).slice(0, 12) : [];
  const value = selected.reduce((s, id) => s + (byId.get(id)?.price ?? 0), 0);
  const updateSelection = (next: string[]) => {
    setSelected(next);
    onSelectionChange?.(next);
  };
  return (
    <div className="space-y-2">
      {selected.map((id) => (
        <input key={id} type="hidden" name="productIds" value={id} />
      ))}
      <div className="flex flex-wrap gap-2">
        {selected.map((id) => (
          <span key={id} className="inline-flex items-center gap-1 rounded-full bg-ia-light px-3 py-1 text-xs font-medium text-ia-dark">
            {byId.get(id)?.name ?? id}
            <button type="button" aria-label={removeLabel} onClick={() => updateSelection(selected.filter((x) => x !== id))}>
              <X size={13} />
            </button>
          </span>
        ))}
        {!selected.length && <span className="text-xs text-navy/60">Aucun produit choisi.</span>}
      </div>
      {showValue && selected.length > 0 && <p className="text-xs text-navy/70">Valeur à l&apos;unité (prix normal le plus bas de chaque produit) : {value.toLocaleString("fr-FR")} FCFA</p>}
      <label className="flex items-center gap-2 rounded-lg border border-line px-3 py-2">
        <Search size={15} className="text-navy/50" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher un produit (nom ou code) à ajouter" className="min-w-0 flex-1 text-sm outline-none" />
      </label>
      {results.length > 0 && (
        <ul className="max-h-60 overflow-auto rounded-lg border border-line">
          {results.map((p) => {
            const on = selected.includes(p.id);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => updateSelection(on ? selected.filter((x) => x !== p.id) : max && selected.length >= max ? selected : [...selected, p.id])}
                  className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-cream ${on ? "bg-ia-light/60" : ""}`}
                >
                  <span>
                    {p.name} {p.code && <span className="text-xs text-navy/55">· {p.code}</span>}
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-navy/70">
                    {p.price ? priceLabel(p.price, (p as { multiFormat?: boolean }).multiFormat) : ""} {on && <Check size={15} className="text-ia" />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Relances automatiques de mes clients (Mon profil, revendeur). */
export function AutoRelancesToggle({ on }: { on: boolean }) {
  const [state, setState] = useState(on);
  const [pending, start] = useTransition();
  return (
    <label className="flex items-start gap-3 text-sm text-navy">
      <input
        type="checkbox"
        checked={state}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.checked;
          setState(next);
          start(async () => {
            try {
              await setMyAutoRelances(next);
            } catch {
              setState(!next);
            }
          });
        }}
        className="mt-1 h-4 w-4"
      />
      <span>
        <strong>Relances automatiques de mes clients</strong>
        <span className="block text-xs text-navy/70">
          JAMAAL envoie pour vous, sur WhatsApp et avec votre lien : le rappel « bientôt fini ? » 45 jours après un achat, le message d&apos;anniversaire avec un code cadeau, et le rappel d&apos;un panier non terminé. Décochez pour vous en occuper vous-même.
        </span>
      </span>
    </label>
  );
}

/** Quiz de formation : une question à la fois, correction détaillée à la fin. */
export function QuizRunner({ quiz, best }: { quiz: Quiz; best: { score: number; total: number } | null }) {
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<Awaited<ReturnType<typeof submitQuiz>> | null>(null);
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const i = answers.length;
  const done = i >= quiz.questions.length;

  if (!open)
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white p-4">
        <div>
          <p className="font-semibold text-navy">{quiz.title}</p>
          <p className="text-xs text-navy/70">
            {quiz.intro} · {quiz.questions.length} questions{best ? ` · meilleur score ${best.score}/${best.total}` : ""}
          </p>
        </div>
        <button type="button" onClick={() => setOpen(true)} className="rounded-full bg-ia px-4 py-2 text-sm font-semibold text-white hover:bg-ia-dark">
          {best ? "Refaire le quiz" : "Commencer"}
        </button>
      </div>
    );

  return (
    <div className="rounded-2xl border border-ia/30 bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-ia">{quiz.title}</p>
      {!done ? (
        <>
          <p className="mt-2 text-sm text-navy/60">
            Question {i + 1} / {quiz.questions.length}
          </p>
          <p className="mt-1 font-semibold text-navy">{quiz.questions[i].question}</p>
          <div className="mt-3 grid gap-2">
            {quiz.questions[i].choices.map((c, k) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  const next = [...answers, k];
                  setAnswers(next);
                  if (next.length >= quiz.questions.length) start(async () => setResult(await submitQuiz(quiz.id, next)));
                }}
                className="rounded-xl border border-line px-4 py-2.5 text-left text-sm text-navy hover:border-ia hover:bg-ia-light/50"
              >
                {c}
              </button>
            ))}
          </div>
        </>
      ) : pending || !result ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-navy/70">
          <Loader2 size={16} className="animate-spin" /> Correction…
        </p>
      ) : (
        <div className="mt-3">
          <p className="text-lg font-semibold text-navy">
            {result.score} / {result.total} {result.score === result.total ? "🏆 Parfait !" : result.score >= result.total / 2 ? "👏 Bien joué" : "💪 À revoir"}
          </p>
          <ul className="mt-3 space-y-2">
            {result.corrections.map((c) => (
              <li key={c.question} className={`rounded-xl px-3 py-2 text-sm ${c.ok ? "bg-ia-light/60 text-navy" : "bg-rose/10 text-navy"}`}>
                <p className="font-medium">
                  {c.ok ? "✅" : "❌"} {c.question}
                </p>
                {!c.ok && <p className="text-xs">Bonne réponse : {c.good}</p>}
                <p className="text-xs text-navy/70">{c.explanation}</p>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => {
              setAnswers([]);
              setResult(null);
            }}
            className="mt-3 rounded-full border border-line px-4 py-2 text-sm font-semibold text-navy"
          >
            Recommencer
          </button>
        </div>
      )}
    </div>
  );
}

/** Visuels de produits à partager (statut WhatsApp, Instagram), avec QR code et coordonnées. */
type VisualProduct = { slug: string; name: string; price?: number | null; choganCode?: string | null; inspiredBy?: string | null; inspiredBrand?: string | null };

export function VisualGenerator({ products, refSlug, origin = "" }: { products: VisualProduct[]; refSlug: string | null; origin?: string }) {
  const [q, setQ] = useState("");
  const [slug, setSlug] = useState(products[0]?.slug ?? "");
  const [format, setFormat] = useState<"story" | "carre">("story");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const matches = findProducts(products, q, 8);
  const src = slug ? `/api/visuel/${slug}?format=${format}${refSlug ? `&ref=${refSlug}` : ""}` : "";
  const product = products.find((p) => p.slug === slug);
  const name = product?.name ?? "produit";
  const base = origin || (typeof window !== "undefined" ? window.location.origin : "");
  const link = slug ? `${base}/produits/${slug}${refSlug ? `?ref=${refSlug}` : ""}` : "";
  const text = `${name}${product?.price ? ` — ${product.price.toLocaleString("fr-FR")} FCFA` : ""}. Commande ici : ${link}`;
  const waText = `https://wa.me/?text=${encodeURIComponent(text)}`;

  /** Image + texte dans WhatsApp quand le téléphone le permet ; sinon l'image est téléchargée et WhatsApp s'ouvre avec le texte et le lien. */
  async function share() {
    setMsg(null);
    setBusy(true);
    try {
      const blob = await (await fetch(src)).blob();
      const file = new File([blob], `${slug}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text });
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${slug}.png`;
        a.click();
        window.open(waText, "_blank", "noopener");
        setMsg("Image téléchargée et WhatsApp ouvert avec le texte et votre lien : joignez l'image à votre message ou à votre statut.");
      }
    } catch {
      // partage annulé
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5 md:grid-cols-[1fr_260px]">
      <div className="space-y-3">
        <label className="flex items-center gap-2 rounded-lg border border-line px-3 py-2">
          <Search size={15} className="text-navy/50" />
          <input type="search" aria-label="Chercher un produit" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom, code ou parfum (ex. Sauvage)" className="min-w-0 flex-1 text-sm outline-none" />
        </label>
        {matches.length > 0 && (
          <ul className="rounded-lg border border-line">
            {matches.map((p) => (
              <li key={p.slug}>
                <button
                  type="button"
                  onClick={() => {
                    setSlug(p.slug);
                    setQ("");
                  }}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-cream"
                >
                  <span className="block">{p.name}</span>
                  {(p.choganCode || p.inspiredBy) && <span className="block truncate text-xs text-navy/60">{[p.choganCode, inspirationLabel(p)].filter(Boolean).join(" · ")}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-sm text-navy">
          Produit : <strong>{name}</strong>
        </p>
        <div className="flex gap-2 text-sm">
          {(["story", "carre"] as const).map((f) => (
            <button key={f} type="button" onClick={() => setFormat(f)} className={`rounded-full px-3 py-1.5 font-semibold ${format === f ? "bg-ia text-white" : "border border-line text-navy"}`}>
              {f === "story" ? "Statut / Story" : "Carré (post)"}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={share} disabled={!src || busy} className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {busy ? <Loader2 size={15} className="animate-spin" /> : null} Partager l&apos;image (WhatsApp…)
          </button>
          <a href={waText} target="_blank" rel="noopener noreferrer" className="rounded-full border border-[#25D366] px-4 py-2 text-sm font-semibold text-[#128C4B]">
            Envoyer le lien sur WhatsApp
          </a>
          <a href={src} download={`${slug}.png`} className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-navy">
            Télécharger l&apos;image
          </a>
        </div>
        {msg && <p className="text-xs text-navy/70">{msg}</p>}
        <p className="text-xs text-navy/60">Le QR code et le lien mènent au produit avec votre code : la vente vous est attribuée.</p>
      </div>
      {src && (
        // eslint-disable-next-line @next/next/no-img-element -- image générée par le site
        <img key={src} src={src} alt={`Visuel ${name}`} className="w-full rounded-2xl border border-line bg-navy/5" />
      )}
    </div>
  );
}
