"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { ArrowRight, ArrowUpRight, Clock, CornerDownLeft, Loader2, Search, Sparkles, X } from "lucide-react";
import { useSearchStore } from "@/lib/search-store";
import { formatPrice } from "@/lib/currency";
import type { Category } from "@/data/types";

type Suggestion = {
  slug: string;
  name: string;
  code: string | null;
  number: number | null;
  inspiredBy: string | null;
  inspiredBrand: string | null;
  category: string;
  price: number | null;
  photo: string | null;
  colorFrom: string;
  colorTo: string;
};
type Result = {
  query: string;
  corrected: string | null;
  total: number;
  products: Suggestion[];
  brands: { brand: string; count: number }[];
  categories: { slug: string; label: string; count: number }[];
};

const TRENDING = ["Sauvage", "Baccarat Rouge 540", "One Million", "Black Opium", "La Vie est Belle", "Oud Wood", "Coco Mademoiselle", "Aventus"];
const RECENT_KEY = "jamaal-recent-searches";

function readRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, 6) : [];
  } catch {
    return [];
  }
}
function writeRecent(list: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 6)));
  } catch {
    // stockage indisponible (navigation privée) : on ignore
  }
}

const fold = (c: string) => c.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Met en valeur les mots tapés, sans tenir compte des accents ni des majuscules. */
function Highlight({ text, terms }: { text: string; terms: string[] }) {
  if (!terms.length) return <>{text}</>;
  const folded = [...text].map(fold).join("");
  const marks = new Array(text.length).fill(false);
  for (const t of terms) {
    if (t.length < 2) continue;
    let i = folded.indexOf(t);
    while (i !== -1) {
      for (let k = i; k < i + t.length && k < marks.length; k++) marks[k] = true;
      i = folded.indexOf(t, i + t.length);
    }
  }
  const parts: { s: string; m: boolean }[] = [];
  [...text].forEach((ch, i) => {
    const last = parts[parts.length - 1];
    if (last && last.m === marks[i]) last.s += ch;
    else parts.push({ s: ch, m: marks[i] });
  });
  return <>{parts.map((p, i) => (p.m ? <mark key={i} className="bg-transparent font-semibold text-[#9c6254]">{p.s}</mark> : <span key={i}>{p.s}</span>))}</>;
}

function Thumb({ p }: { p: Suggestion }) {
  return (
    <span className="relative flex h-16 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#f5ece8] ring-1 ring-[#eadfda]" style={p.photo ? undefined : { background: `linear-gradient(140deg, ${p.colorFrom}, ${p.colorTo})` }}>
      {p.photo ? <Image src={p.photo} alt="" fill sizes="56px" className="object-contain p-1" /> : <span className="text-[10px] font-semibold tracking-wide text-white/90">{p.code}</span>}
    </span>
  );
}

export function SearchOverlay({ categories }: { categories: Category[] }) {
  const { isOpen, initial, open, close, openId } = useSearchStore();

  // Ouverture : Ctrl/Cmd + K ou « / » depuis n'importe quelle page.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        open();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!isOpen) return null;
  // Rendu dans <body> : l'en-tête (flou d'arrière-plan) ne doit pas contraindre la position fixe.
  return createPortal(<SearchPanel key={openId} initial={initial} close={close} categories={categories} />, document.body);
}

function SearchPanel({ initial, close, categories }: { initial: string; close: () => void; categories: Category[] }) {
  const router = useRouter();
  const [query, setQuery] = useState(initial);
  const [store, setStore] = useState<Record<string, Result>>({});
  const [nav, setNav] = useState({ key: "", i: -1 });
  const [recent, setRecent] = useState<string[]>(readRecent);
  const inputRef = useRef<HTMLInputElement>(null);

  const q = query.trim();
  const key = q.toLowerCase();
  const result = q ? store[key] ?? null : null;
  const loading = !!q && !result;
  const active = nav.key === key ? nav.i : -1;
  const setActive = (f: number | ((a: number) => number)) => setNav((n) => ({ key, i: typeof f === "function" ? f(n.key === key ? n.i : -1) : f }));

  // Bloque le défilement de la page tant que la recherche est ouverte.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Suggestions instantanées (attente courte ; une requête obsolète est annulée).
  const known = !!store[key];
  useEffect(() => {
    if (!key || known) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(key)}`, { signal: ctrl.signal })
        .then((r) => r.json() as Promise<Result>)
        .then((r) => setStore((s) => ({ ...s, [key]: r })))
        .catch(() => {});
    }, 110);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [key, known]);

  const terms = useMemo(() => fold(result?.query ?? query).split(/[^a-z0-9]+/).filter((t) => t.length >= 2), [result, query]);
  const products = result?.products ?? [];
  const showAll = !!result && result.total > 0;
  const itemCount = products.length + (showAll ? 1 : 0);

  const remember = useCallback((q: string) => {
    const v = q.trim();
    if (!v) return;
    const next = [v, ...readRecent().filter((r) => r.toLowerCase() !== v.toLowerCase())];
    writeRecent(next);
  }, []);

  function goResults(q = query) {
    const v = q.trim();
    if (!v) return;
    remember(v);
    close();
    router.push(`/recherche?q=${encodeURIComponent(v)}`);
  }
  function goProduct(p: Suggestion) {
    remember(query);
    close();
    router.push(`/produits/${p.slug}`);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown" && itemCount) {
      e.preventDefault();
      setActive((a) => (a + 1) % itemCount);
    } else if (e.key === "ArrowUp" && itemCount) {
      e.preventDefault();
      setActive((a) => (a <= 0 ? itemCount - 1 : a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0 && active < products.length) goProduct(products[active]);
      else goResults();
    }
  }

  const perfumeCats = categories.filter((c) => c.slug.startsWith("parfum-")).slice(0, 4);
  const otherCats = categories.filter((c) => !c.slug.startsWith("parfum-")).slice(0, 6);

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Rechercher dans le catalogue">
      <button type="button" aria-label="Fermer la recherche" onClick={close} className="absolute inset-0 h-full w-full cursor-default bg-[#14213b]/45 backdrop-blur-[3px] animate-[fadeIn_.15s_ease-out]" />
      <div className="relative mx-auto flex h-full max-h-full flex-col bg-[#fdfbfa] shadow-[0_30px_80px_-20px_rgba(20,33,59,.45)] sm:mt-4 sm:h-auto sm:max-h-[min(86vh,820px)] sm:w-[min(980px,calc(100%-2rem))] sm:rounded-3xl animate-[slideDown_.18s_ease-out]">
        {/* Champ de recherche */}
        <div className="flex items-center gap-3 border-b border-[#eadfda] px-5 py-4 sm:px-7 sm:py-5">
          {loading ? <Loader2 size={22} className="shrink-0 animate-spin text-[#9c6254]" /> : <Search size={22} className="shrink-0 text-[#9c6254]" />}
          <input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            spellCheck={false}
            aria-label="Rechercher un parfum"
            aria-controls="search-results"
            aria-activedescendant={active >= 0 ? `sr-${active}` : undefined}
            placeholder="Un parfum, une marque, un code…"
            className="min-w-0 flex-1 bg-transparent font-serif-display text-xl text-[#14213b] outline-none placeholder:text-navy/35 sm:text-[28px] [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button type="button" onClick={() => { setQuery(""); inputRef.current?.focus(); }} className="rounded-full px-3 py-1.5 text-xs font-medium text-navy/70 hover:bg-navy/5">
              Effacer
            </button>
          )}
          <kbd className="hidden rounded-md border border-[#eadfda] px-2 py-1 text-[11px] text-navy/60 sm:block">Échap</kbd>
          <button type="button" onClick={close} aria-label="Fermer" className="rounded-full p-2 text-navy/70 hover:bg-navy/5 sm:hidden">
            <X size={20} />
          </button>
        </div>

        <div id="search-results" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6 pt-4 sm:px-7">
          {!query.trim() ? (
            <div className="grid grid-cols-1 gap-8 py-2 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
              <div>
                {recent.length > 0 && (
                  <section className="mb-7">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#9c6254]">Recherches récentes</p>
                      <button type="button" onClick={() => { writeRecent([]); setRecent([]); }} className="text-xs text-navy/55 hover:text-navy">Effacer</button>
                    </div>
                    <ul className="mt-3 flex flex-col">
                      {recent.map((r) => (
                        <li key={r}>
                          <button type="button" onClick={() => setQuery(r)} className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-[15px] text-navy hover:bg-[#f5ece8]">
                            <Clock size={16} className="text-navy/40" /> {r}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#9c6254]"><Sparkles size={13} /> Les plus recherchés</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {TRENDING.map((t) => (
                    <button key={t} type="button" onClick={() => setQuery(t)} className="rounded-full border border-[#eadfda] bg-white px-4 py-2 text-sm text-navy transition hover:border-[#c9997a] hover:bg-[#f5ece8]">
                      {t}
                    </button>
                  ))}
                </div>
                <p className="mt-6 text-sm leading-6 text-navy/60">
                  Cherchez par nom, par grand parfum (« Sauvage », « Dior »), par code Chogan (« 001M », « BSF016 ») ou par note (« vanille », « oud »). Les fautes de frappe sont tolérées.
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#9c6254]">Collections</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {perfumeCats.map((c) => (
                    <Link key={c.slug} href={`/collections/${c.slug}`} onClick={close} className="group rounded-2xl bg-[#14213b] px-4 py-4 text-[#f5ece8] transition hover:bg-[#1d2f4f]">
                      <span className="block font-serif-display text-lg leading-tight">{c.navLabel.replace("JAMAAL ", "")}</span>
                      <span className="mt-1 flex items-center gap-1 text-[11px] uppercase tracking-[0.16em] text-[#ecc6a6]">Découvrir <ArrowUpRight size={12} /></span>
                    </Link>
                  ))}
                </div>
                <ul className="mt-3 flex flex-col">
                  {otherCats.map((c) => (
                    <li key={c.slug}>
                      <Link href={`/collections/${c.slug}`} onClick={close} className="flex items-center justify-between rounded-lg px-2 py-2 text-sm text-navy hover:bg-[#f5ece8]">
                        {c.navLabel.replace("JAMAAL ", "")} <ArrowRight size={14} className="text-navy/40" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : result && result.total === 0 && !loading ? (
            <div className="py-10 text-center">
              <p className="font-serif-display text-2xl text-navy">Aucun parfum pour « {query} »</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-navy/60">Essayez le nom d&apos;un grand parfum, une marque, un code Chogan ou une note olfactive.</p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {TRENDING.slice(0, 5).map((t) => (
                  <button key={t} type="button" onClick={() => setQuery(t)} className="rounded-full border border-[#eadfda] bg-white px-4 py-2 text-sm text-navy hover:bg-[#f5ece8]">{t}</button>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
              <div className="min-w-0">
                {result?.corrected && (
                  <p className="mb-3 rounded-xl bg-[#f5ece8] px-3.5 py-2.5 text-sm text-navy/80">
                    Résultats pour <b className="text-navy">« {result.corrected} »</b>, au lieu de « {query} »
                  </p>
                )}
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#9c6254]">Parfums{result ? ` · ${result.total}` : ""}</p>
                  {showAll && result!.total > products.length && (
                    <button type="button" onClick={() => goResults(result?.corrected ?? query)} className="flex items-center gap-1 text-xs font-semibold text-navy hover:text-[#9c6254]">
                      Tout voir <ArrowRight size={13} />
                    </button>
                  )}
                </div>
                {!result && loading ? (
                  <ul className="flex flex-col gap-2">
                    {[0, 1, 2, 3].map((i) => <li key={i} className="h-[76px] animate-pulse rounded-xl bg-[#f5ece8]" />)}
                  </ul>
                ) : (
                  <ul className="flex flex-col" role="listbox" aria-label="Parfums suggérés">
                    {products.map((p, i) => (
                      <li key={p.slug} id={`sr-${i}`} role="option" aria-selected={active === i}>
                        <Link
                          href={`/produits/${p.slug}`}
                          onClick={(e) => { e.preventDefault(); goProduct(p); }}
                          onMouseEnter={() => setActive(i)}
                          className={`flex items-center gap-4 rounded-xl px-2.5 py-2.5 transition ${active === i ? "bg-[#f5ece8]" : "hover:bg-[#f5ece8]/70"}`}
                        >
                          <Thumb p={p} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-serif-display text-[17px] leading-snug text-[#14213b]"><Highlight text={p.name} terms={terms} /></span>
                            {p.inspiredBy && (
                              <span className="block truncate text-[13px] text-navy/75">
                                Inspiré de <span className="font-medium text-navy"><Highlight text={p.inspiredBy} terms={terms} /></span>
                                {p.inspiredBrand && <> · <span className="uppercase tracking-wide text-[11px] text-[#9c6254]"><Highlight text={p.inspiredBrand} terms={terms} /></span></>}
                              </span>
                            )}
                            <span className="mt-0.5 block text-[11px] uppercase tracking-[0.12em] text-navy/50">
                              {p.code ? <>Code <Highlight text={p.code} terms={terms} /> · </> : null}{p.category}
                            </span>
                          </span>
                          {p.price ? <span className="hidden shrink-0 text-right text-sm font-semibold text-navy sm:block"><span className="block text-[10px] font-normal uppercase tracking-wide text-navy/50">dès</span>{formatPrice(p.price)}</span> : null}
                          {active === i && <CornerDownLeft size={15} className="hidden shrink-0 text-navy/40 sm:block" />}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                {showAll && (
                  <button
                    type="button"
                    id={`sr-${products.length}`}
                    onMouseEnter={() => setActive(products.length)}
                    onClick={() => goResults(result?.corrected ?? query)}
                    className={`mt-3 flex w-full items-center justify-between rounded-xl px-4 py-3.5 text-sm font-semibold transition ${active === products.length ? "bg-[#14213b] text-white" : "bg-[#14213b]/95 text-white hover:bg-[#14213b]"}`}
                  >
                    Voir les {result!.total} résultat{result!.total > 1 ? "s" : ""} <ArrowRight size={16} />
                  </button>
                )}
              </div>

              {result && (result.brands.length > 0 || result.categories.length > 0) && (
                <aside className="flex flex-col gap-6 sm:border-l sm:border-[#eadfda] sm:pl-6">
                  {result.brands.length > 0 && (
                    <section>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#9c6254]">Inspirés de la marque</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {result.brands.map((b) => (
                          <button key={b.brand} type="button" onClick={() => setQuery(b.brand)} className="rounded-full border border-[#eadfda] bg-white px-3.5 py-1.5 text-sm text-navy hover:border-[#c9997a] hover:bg-[#f5ece8]">
                            {b.brand} <span className="text-navy/45">{b.count}</span>
                          </button>
                        ))}
                      </div>
                    </section>
                  )}
                  {result.categories.length > 0 && (
                    <section>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#9c6254]">Dans les collections</p>
                      <ul className="mt-2 flex flex-col">
                        {result.categories.map((c) => (
                          <li key={c.slug}>
                            <button type="button" onClick={() => { remember(query); close(); router.push(`/recherche?q=${encodeURIComponent(result.query)}&cat=${c.slug}`); }} className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm text-navy hover:bg-[#f5ece8]">
                              <span>{c.label}</span><span className="text-navy/45">{c.count}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}
                </aside>
              )}
            </div>
          )}
        </div>

        <div className="hidden items-center gap-5 border-t border-[#eadfda] px-7 py-3 text-[11px] text-navy/50 sm:flex">
          <span><kbd className="rounded border border-[#eadfda] px-1.5">↑</kbd> <kbd className="rounded border border-[#eadfda] px-1.5">↓</kbd> naviguer</span>
          <span><kbd className="rounded border border-[#eadfda] px-1.5">Entrée</kbd> ouvrir</span>
          <span><kbd className="rounded border border-[#eadfda] px-1.5">Ctrl K</kbd> rechercher partout</span>
        </div>
      </div>
    </div>
  );
}
