"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { ArrowRight, Clock, CornerDownLeft, LayoutGrid, Loader2, Package, Search, ShoppingCart, Tag, Truck, User, Users, X } from "lucide-react";
import { globalAdminSearch } from "@/lib/actions/global-search";
import type { BoItem, BoProduct, BoResult } from "@/lib/backoffice-search";

export type SearchPage = { href: string; label: string; group?: string };

const RECENT_KEY = "jamaal-bo-recherches";
const fold = (c: string) => c.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const fcfa = (n: number) => `${n.toLocaleString("fr-FR")} FCFA`;

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
  } catch {}
}

/** Met en valeur les mots tapés (sans accents ni majuscules). */
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
  return <>{parts.map((p, i) => (p.m ? <mark key={i} className="bg-transparent font-semibold text-rose-dark">{p.s}</mark> : <span key={i}>{p.s}</span>))}</>;
}

/** Pages du menu correspondant à la requête (libellé et rubrique, sans accents). */
function matchPages(pages: SearchPage[], q: string): SearchPage[] {
  const words = fold(q).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return pages.filter((p) => {
    const hay = fold(`${p.label} ${p.group ?? ""} ${p.href.replace(/[/-]/g, " ")}`);
    return words.every((w) => hay.includes(w));
  }).slice(0, 5);
}

type Flat = { key: string; href: string };

function Title({ children }: { children: React.ReactNode }) {
  return <p className="mb-1.5 mt-4 text-[10px] font-semibold uppercase tracking-[0.22em] text-rose-dark first:mt-0">{children}</p>;
}

/**
 * Barre de recherche du back-office (administrateur, revendeur, livreur) : même puissance que la recherche
 * du site (fautes de frappe, codes Chogan, grands parfums, notes, marques, collections) plus les commandes,
 * clients, conseillers, livreurs, codes promo et pages du menu, selon les droits de chacun.
 * Ctrl/Cmd + K ou « / » l'ouvre ; ↑ ↓ pour naviguer, Entrée pour ouvrir.
 */
export function GlobalSearch({ tone = "dark", pages = [], shortcut = false }: { tone?: "dark" | "light"; pages?: SearchPage[]; shortcut?: boolean }) {
  const light = tone === "light";
  const [open, setOpen] = useState(false);
  const [seed, setSeed] = useState("");
  const [openId, setOpenId] = useState(0);
  const show = (initial = "") => {
    setSeed(initial);
    setOpenId((n) => n + 1);
    setOpen(true);
  };

  useEffect(() => {
    if (!shortcut) return;
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      if ((e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        show();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shortcut]);

  return (
    <>
      <button
        type="button"
        onClick={() => show()}
        aria-label="Rechercher"
        className={`relative flex w-full items-center rounded-full text-left transition ${light ? "border border-line bg-cream/60 py-2 pl-9 pr-12 text-sm text-navy/55 hover:bg-white" : "border border-white/10 bg-white/10 py-1.5 pl-9 pr-10 text-xs text-white/55 hover:bg-white/15"}`}
      >
        <Search size={16} className={`absolute left-3.5 ${light ? "text-navy/50" : "text-white/65"}`} />
        <span className="truncate">{light ? "Rechercher un produit, une commande, un client…" : "Rechercher…"}</span>
        <kbd className={`absolute right-3 hidden rounded border px-1.5 py-0.5 font-mono text-xs sm:inline-block ${light ? "border-line text-navy/50" : "border-white/20 bg-white/5 text-white/65"}`}>⌘K</kbd>
      </button>
      {open && createPortal(<Panel key={openId} initial={seed} pages={pages} close={() => setOpen(false)} />, document.body)}
    </>
  );
}

function Panel({ initial, pages, close }: { initial: string; pages: SearchPage[]; close: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState(initial);
  const [store, setStore] = useState<Record<string, BoResult | null>>({});
  const [nav, setNav] = useState({ key: "", i: -1 });
  const [recent, setRecent] = useState<string[]>(readRecent);
  const inputRef = useRef<HTMLInputElement>(null);

  const q = query.trim();
  const key = q.toLowerCase();
  const known = key in store;
  const result = q.length >= 2 ? store[key] ?? null : null;
  const loading = q.length >= 2 && !known;

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    if (key.length < 2 || known) return;
    let cancelled = false;
    const t = setTimeout(() => {
      globalAdminSearch(key)
        .then((r) => !cancelled && setStore((s) => ({ ...s, [key]: r })))
        .catch(() => !cancelled && setStore((s) => ({ ...s, [key]: null })));
    }, 140);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [key, known]);

  const terms = useMemo(() => fold(result?.query ?? query).split(/[^a-z0-9]+/).filter((t) => t.length >= 2), [result, query]);
  const pageHits = useMemo(() => matchPages(pages, q), [pages, q]);
  const sections: { id: string; label: string; icon: React.ReactNode; items: BoItem[] }[] = result
    ? [
        { id: "orders", label: "Commandes", icon: <ShoppingCart size={15} className="text-blue-600" />, items: result.orders },
        { id: "customers", label: "Clients", icon: <User size={15} className="text-emerald-600" />, items: result.customers },
        { id: "consultants", label: "Conseillers", icon: <Users size={15} className="text-amber-600" />, items: result.consultants },
        { id: "livreurs", label: "Livreurs", icon: <Truck size={15} className="text-sky-600" />, items: result.livreurs },
        { id: "coupons", label: "Codes promo", icon: <Tag size={15} className="text-rose-dark" />, items: result.coupons },
      ].filter((s) => s.items.length > 0)
    : [];
  const products = result?.products ?? [];
  const resultsHref = `/admin/recherche?q=${encodeURIComponent(result?.corrected ?? q)}`;

  // Liste à plat pour le clavier : produits, « tout voir », pages, puis les autres rubriques.
  const flat: Flat[] = [
    ...products.map((p) => ({ key: `p:${p.id}`, href: p.href })),
    ...(q.length >= 2 ? [{ key: "all", href: resultsHref }] : []),
    ...pageHits.map((p) => ({ key: `g:${p.href}`, href: p.href })),
    ...sections.flatMap((s) => s.items.map((it) => ({ key: `${s.id}:${it.id}`, href: it.href }))),
  ];
  const active = nav.key === key ? nav.i : -1;
  const setActive = (f: number | ((a: number) => number)) => setNav((n) => ({ key, i: typeof f === "function" ? f(n.key === key ? n.i : -1) : f }));
  const isActive = (k: string) => active >= 0 && flat[active]?.key === k;
  const hover = (k: string) => setActive(flat.findIndex((f) => f.key === k));

  function remember(v: string) {
    const s = v.trim();
    if (s.length < 2) return;
    writeRecent([s, ...readRecent().filter((r) => r.toLowerCase() !== s.toLowerCase())]);
  }
  function go(href: string) {
    remember(query);
    close();
    router.push(href);
  }
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown" && flat.length) {
      e.preventDefault();
      setActive((a) => (a + 1) % flat.length);
    } else if (e.key === "ArrowUp" && flat.length) {
      e.preventDefault();
      setActive((a) => (a <= 0 ? flat.length - 1 : a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0 && flat[active]) go(flat[active].href);
      else if (q.length >= 2) go(resultsHref);
    }
  }

  const rowCls = (k: string) => `flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition ${isActive(k) ? "bg-cream" : "hover:bg-cream/70"}`;

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Rechercher dans l'espace JAMAAL">
      <button type="button" aria-label="Fermer la recherche" onClick={close} className="absolute inset-0 h-full w-full cursor-default bg-navy/45 backdrop-blur-[2px]" />
      <div className="relative mx-auto flex h-full max-h-full flex-col bg-white shadow-2xl sm:mt-6 sm:h-auto sm:max-h-[min(86vh,820px)] sm:w-[min(1040px,calc(100%-2rem))] sm:rounded-3xl">
        <div className="flex items-center gap-3 border-b border-line px-4 py-3.5 sm:px-6 sm:py-4">
          {loading ? <Loader2 size={20} className="shrink-0 animate-spin text-rose-dark" /> : <Search size={20} className="shrink-0 text-rose-dark" />}
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
            aria-label="Rechercher"
            placeholder="Un parfum, un code, une commande, un client, une page…"
            className="min-w-0 flex-1 bg-transparent font-serif-display text-lg text-navy outline-none placeholder:text-navy/35 sm:text-2xl [&::-webkit-search-cancel-button]:hidden"
          />
          {query && <button type="button" onClick={() => { setQuery(""); inputRef.current?.focus(); }} className="rounded-full px-3 py-1.5 text-xs font-medium text-navy/70 hover:bg-navy/5">Effacer</button>}
          <kbd className="hidden rounded-md border border-line px-2 py-1 text-[11px] text-navy/60 sm:block">Échap</kbd>
          <button type="button" onClick={close} aria-label="Fermer" className="rounded-full p-2 text-navy/70 hover:bg-navy/5 sm:hidden"><X size={20} /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-6 pt-4 sm:px-6">
          {q.length < 2 ? (
            <div className="grid gap-8 sm:grid-cols-2">
              <div>
                {recent.length > 0 && (
                  <>
                    <div className="flex items-center justify-between">
                      <Title>Recherches récentes</Title>
                      <button type="button" onClick={() => { writeRecent([]); setRecent([]); }} className="text-xs text-navy/55 hover:text-navy">Effacer</button>
                    </div>
                    <ul>
                      {recent.map((r) => (
                        <li key={r}><button type="button" onClick={() => setQuery(r)} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm text-navy hover:bg-cream"><Clock size={15} className="text-navy/40" /> {r}</button></li>
                      ))}
                    </ul>
                  </>
                )}
                <p className="mt-4 text-sm leading-6 text-navy/65">
                  Cherchez un parfum par nom, grand parfum (« Sauvage »), marque (« Dior »), code Chogan (« 001M ») ou note (« vanille ») ; une commande par son n°, le nom ou le téléphone du client ; un client, un conseiller, un code promo ou une page du menu. Les fautes de frappe sont tolérées.
                </p>
              </div>
              {pages.length > 0 && (
                <div>
                  <Title>Accès rapide</Title>
                  <div className="grid grid-cols-2 gap-1.5">
                    {pages.slice(0, 10).map((p) => (
                      <button key={p.href} type="button" onClick={() => go(p.href)} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-left text-sm text-navy hover:bg-cream">
                        <LayoutGrid size={14} className="shrink-0 text-navy/40" /> <span className="truncate">{p.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
              <div className="min-w-0">
                {result?.corrected && (
                  <p className="mb-3 rounded-xl bg-cream px-3.5 py-2.5 text-sm text-navy/80">Résultats pour <b className="text-navy">« {result.corrected} »</b>, au lieu de « {q} »</p>
                )}
                <div className="flex items-center justify-between">
                  <Title>Produits{result ? ` · ${result.total}` : ""}</Title>
                </div>
                {loading && !result ? (
                  <ul className="flex flex-col gap-2">{[0, 1, 2, 3].map((i) => <li key={i} className="h-[68px] animate-pulse rounded-xl bg-cream" />)}</ul>
                ) : products.length === 0 ? (
                  <p className="rounded-xl bg-cream/60 px-3 py-4 text-sm text-navy/65">Aucun produit pour « {q} ».</p>
                ) : (
                  <ul className="flex flex-col">
                    {products.map((p) => <ProductRow key={p.id} p={p} terms={terms} active={isActive(`p:${p.id}`)} onHover={() => hover(`p:${p.id}`)} onGo={() => go(p.href)} />)}
                  </ul>
                )}
                {!loading && (
                  <button type="button" onMouseEnter={() => hover("all")} onClick={() => go(resultsHref)} className={`mt-3 flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold text-white transition ${isActive("all") ? "bg-navy" : "bg-navy/95 hover:bg-navy"}`}>
                    Voir tous les résultats {result?.total ? `(${result.total} produit${result.total > 1 ? "s" : ""})` : ""} <ArrowRight size={16} />
                  </button>
                )}
              </div>

              <aside className="min-w-0 sm:border-l sm:border-line sm:pl-6">
                {pageHits.length > 0 && (
                  <section>
                    <Title>Pages</Title>
                    {pageHits.map((p) => (
                      <button key={p.href} type="button" onMouseEnter={() => hover(`g:${p.href}`)} onClick={() => go(p.href)} className={rowCls(`g:${p.href}`)}>
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cream"><LayoutGrid size={15} className="text-navy/60" /></span>
                        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-navy"><Highlight text={p.label} terms={terms} /></span>{p.group && <span className="block truncate text-xs text-navy/60">{p.group}</span>}</span>
                      </button>
                    ))}
                  </section>
                )}
                {sections.map((s) => (
                  <section key={s.id}>
                    <Title>{s.label}</Title>
                    {s.items.map((it) => (
                      <button key={it.id} type="button" onMouseEnter={() => hover(`${s.id}:${it.id}`)} onClick={() => go(it.href)} className={rowCls(`${s.id}:${it.id}`)}>
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cream">{s.icon}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-navy"><Highlight text={it.title} terms={terms} /></span>
                          <span className="block truncate text-xs text-navy/65"><Highlight text={it.subtitle} terms={terms} /></span>
                        </span>
                        {it.badge && <span className="shrink-0 rounded-full bg-cream px-2 py-0.5 text-[10px] font-semibold text-navy/75">{it.badge}</span>}
                      </button>
                    ))}
                  </section>
                ))}
                {result && (result.brands.length > 0 || result.categories.length > 0) && (
                  <section>
                    {result.brands.length > 0 && (
                      <>
                        <Title>Inspirés de la marque</Title>
                        <div className="flex flex-wrap gap-1.5">
                          {result.brands.map((b) => (
                            <button key={b.brand} type="button" onClick={() => setQuery(b.brand)} className="rounded-full border border-line px-3 py-1 text-xs text-navy hover:bg-cream">{b.brand} <span className="text-navy/45">{b.count}</span></button>
                          ))}
                        </div>
                      </>
                    )}
                    {result.categories.length > 0 && (
                      <>
                        <Title>Dans les collections</Title>
                        {result.categories.map((c) => (
                          <button key={c.slug} type="button" onClick={() => go(`/admin/recherche?q=${encodeURIComponent(result.query)}&cat=${c.slug}`)} className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm text-navy hover:bg-cream">
                            <span>{c.label}</span><span className="text-navy/45">{c.count}</span>
                          </button>
                        ))}
                      </>
                    )}
                  </section>
                )}
                {result && !pageHits.length && !sections.length && !result.brands.length && (
                  <p className="text-sm text-navy/60">Aucune commande, aucun client ni aucune page pour « {q} ».</p>
                )}
              </aside>
            </div>
          )}
        </div>

        <div className="hidden items-center gap-5 border-t border-line px-6 py-2.5 text-[11px] text-navy/55 sm:flex">
          <span><kbd className="rounded border border-line px-1.5">↑</kbd> <kbd className="rounded border border-line px-1.5">↓</kbd> naviguer</span>
          <span><kbd className="rounded border border-line px-1.5">Entrée</kbd> ouvrir</span>
          <span><kbd className="rounded border border-line px-1.5">Ctrl K</kbd> ou <kbd className="rounded border border-line px-1.5">/</kbd> rechercher partout</span>
        </div>
      </div>
    </div>
  );
}

function ProductRow({ p, terms, active, onHover, onGo }: { p: BoProduct; terms: string[]; active: boolean; onHover: () => void; onGo: () => void }) {
  return (
    <li>
      <button type="button" onMouseEnter={onHover} onClick={onGo} className={`flex w-full items-center gap-3.5 rounded-xl px-2.5 py-2 text-left transition ${active ? "bg-cream" : "hover:bg-cream/70"}`}>
        <span className="relative flex h-14 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-cream ring-1 ring-line" style={p.photo ? undefined : { background: `linear-gradient(140deg, ${p.colorFrom}, ${p.colorTo})` }}>
          {p.photo ? <Image src={p.photo} alt="" fill sizes="48px" className="object-contain p-1" /> : <Package size={18} className="text-white/90" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-serif-display text-base leading-snug text-navy"><Highlight text={p.name} terms={terms} /></span>
          {p.inspiredBy && (
            <span className="block truncate text-xs text-navy/75">Inspiré de <span className="font-medium text-navy"><Highlight text={p.inspiredBy} terms={terms} /></span>{p.inspiredBrand && <> · <Highlight text={p.inspiredBrand} terms={terms} /></>}</span>
          )}
          <span className="mt-0.5 block truncate text-[11px] uppercase tracking-[0.1em] text-navy/50">{p.code ? <>Code <Highlight text={p.code} terms={terms} /> · </> : null}{p.category}</span>
        </span>
        <span className="hidden shrink-0 text-right sm:block">
          {p.price ? <span className="block text-sm font-semibold text-navy">{fcfa(p.price)}</span> : null}
          {p.stock !== null && <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${p.stock > 0 ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>{p.stock > 0 ? `${p.stock} en stock` : "rupture"}</span>}
        </span>
        {active && <CornerDownLeft size={14} className="hidden shrink-0 text-navy/40 sm:block" />}
      </button>
    </li>
  );
}
