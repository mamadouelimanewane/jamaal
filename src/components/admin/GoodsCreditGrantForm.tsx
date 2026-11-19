"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Search, Trash2, X } from "lucide-react";
import { grantGoodsCredit, type GoodsCreditState } from "@/lib/actions/goods-credit";
import { searchProductsForOrder, type ProductSearchResult } from "@/lib/actions/product-search";
import { isUnsoldFormat } from "@/lib/price-from";

type Reseller = { id: string; name: string; city: string; whatsapp: string | null; debt: number };
type Line = { key: string; productId: string | null; name: string; format: string | null; qty: number; unitPrice: number };

const fmt = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} F`;
const field = "w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-navy focus:ring-2 focus:ring-navy/10";
const QUICK = [50_000, 100_000, 200_000, 500_000];
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Octroi d'un crédit de marchandises : revendeur, produits confiés (facultatif), montant, échéance. */
export function GoodsCreditGrantForm({ resellers, preselected }: { resellers: Reseller[]; preselected?: string | null }) {
  const [open, setOpen] = useState(Boolean(preselected));
  const [who, setWho] = useState<string>(preselected ?? "");
  const [rq, setRq] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [amount, setAmount] = useState("");
  const [pq, setPq] = useState("");
  const [hits, setHits] = useState<ProductSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  // Après un octroi réussi, le formulaire repart à vide (les champs libres sont remis à zéro par React).
  const [state, action, pending] = useActionState(async (prev: GoodsCreditState, fd: FormData) => {
    const r = await grantGoodsCredit(prev, fd);
    if (r.ok) {
      setLines([]);
      setAmount("");
      setWho("");
    }
    return r;
  }, { ok: false } as GoodsCreditState);

  const chosen = resellers.find((r) => r.id === who) ?? null;
  const list = useMemo(() => {
    const q = fold(rq.trim());
    return (q ? resellers.filter((r) => fold(`${r.name} ${r.city} ${r.whatsapp ?? ""}`).includes(q)) : resellers).slice(0, 8);
  }, [rq, resellers]);
  const linesTotal = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);

  useEffect(() => {
    const q = pq.trim();
    if (q.length < 2) return;
    let live = true;
    const t = setTimeout(async () => {
      setSearching(true);
      const r = await searchProductsForOrder(q).catch(() => []);
      if (live) {
        setHits(r.slice(0, 6));
        setSearching(false);
      }
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [pq]);


  // Un produit s'ajoute dans le format choisi (15 ml recharge, 30 ml, 70 ml…) à son prix.
  const addProduct = (p: ProductSearchResult, format: { label: string; price: number } | null) => {
    const price = format?.price ?? p.regularPrice ?? 0;
    setLines((ls) => {
      const same = ls.find((l) => l.productId === p.id && l.format === (format?.label ?? null));
      if (same) return ls.map((l) => (l === same ? { ...l, qty: l.qty + 1 } : l));
      return [...ls, { key: `${p.id}-${format?.label ?? "u"}-${Date.now()}`, productId: p.id, name: p.name, format: format?.label ?? null, qty: 1, unitPrice: price }];
    });
  };
  const upd = (key: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy-light">
        <Plus size={16} /> Octroyer un crédit
      </button>
    );
  }

  return (
    <form action={action} className="w-full space-y-5 rounded-2xl border border-line bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-serif-display text-lg font-semibold text-navy">Octroyer un crédit de marchandises</h2>
          <p className="text-sm text-navy/70">Les ventes payées de ce revendeur seront défalquées automatiquement de ce qu&apos;il doit.</p>
        </div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Fermer" className="rounded-lg p-2 text-navy/70 hover:bg-cream"><X size={18} /></button>
      </div>

      <input type="hidden" name="consultantId" value={who} />
      <input type="hidden" name="items" value={JSON.stringify(lines.map(({ productId, name, format, qty, unitPrice }) => ({ productId, name: format ? `${name} — ${format}` : name, format, qty, unitPrice })))} />

      <section>
        <p className="text-sm font-semibold text-navy">1. Revendeur</p>
        {chosen ? (
          <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-navy bg-cream/60 px-4 py-3">
            <div>
              <p className="font-semibold text-navy">{chosen.name}</p>
              <p className="text-xs text-navy/70">{chosen.city}{chosen.whatsapp ? ` · ${chosen.whatsapp}` : ""}{chosen.debt > 0 ? ` · doit déjà ${fmt(chosen.debt)}` : ""}</p>
            </div>
            <button type="button" onClick={() => setWho("")} className="text-xs font-semibold text-navy underline">Changer</button>
          </div>
        ) : (
          <div className="mt-2">
            <label className="relative block">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy/50" />
              <input value={rq} onChange={(e) => setRq(e.target.value)} placeholder="Nom, ville ou téléphone du revendeur" className={`${field} pl-9`} />
            </label>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {list.map((r) => (
                <button key={r.id} type="button" onClick={() => setWho(r.id)} className="rounded-xl border border-line px-3 py-2 text-left text-sm hover:border-navy">
                  <span className="block font-semibold text-navy">{r.name}</span>
                  <span className="block text-xs text-navy/65">{r.city}{r.debt > 0 ? ` · doit ${fmt(r.debt)}` : ""}</span>
                </button>
              ))}
              {!list.length && <p className="text-sm text-navy/60">Aucun revendeur trouvé.</p>}
            </div>
          </div>
        )}
      </section>

      <section>
        <p className="text-sm font-semibold text-navy">2. Marchandises confiées <span className="font-normal text-navy/60">(facultatif)</span></p>
        <p className="text-xs text-navy/65">Si vous listez des produits, seules les ventes de ces produits remboursent ce crédit. Sans liste, toutes ses ventes le remboursent.</p>
        <label className="relative mt-2 block">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy/50" />
          <input value={pq} onChange={(e) => { setPq(e.target.value); if (e.target.value.trim().length < 2) setHits([]); }} placeholder="Ajouter un produit : nom, code, parfum d'inspiration" className={`${field} pl-9`} />
          {searching && <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-navy/50" />}
        </label>
        {hits.length > 0 && (
          <div className="mt-1 divide-y divide-line rounded-xl border border-line bg-white">
            {hits.map((h) => {
              // Formats vendus seulement (pas de 15 ml) : 25 ml, 30 ml, 70 ml…
              const formats = (h.volumes ?? []).filter((v) => v.label && v.price > 0 && !isUnsoldFormat(v.label));
              return (
                <div key={h.id} className="px-3 py-2.5">
                  <p className="text-sm"><span className="font-medium text-navy">{h.name}</span>{h.choganCode ? <span className="ml-2 text-xs text-navy/60">{h.choganCode}</span> : null}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {formats.length ? (
                      formats.map((f) => (
                        <button key={f.label} type="button" onClick={() => addProduct(h, f)} className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-navy hover:border-navy hover:bg-cream">
                          + {f.label} · {fmt(f.price)}
                        </button>
                      ))
                    ) : (
                      <button type="button" onClick={() => addProduct(h, null)} className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-navy hover:border-navy hover:bg-cream">
                        + Ajouter · {fmt(h.regularPrice ?? 0)}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            <button type="button" onClick={() => { setPq(""); setHits([]); }} className="w-full px-3 py-2 text-center text-xs text-navy/60 hover:bg-cream/60">Fermer la recherche</button>
          </div>
        )}
        {lines.length > 0 && (
          <div className="mt-3 space-y-2">
            {lines.map((l) => (
              <div key={l.key} className="flex flex-wrap items-center gap-2 rounded-xl bg-cream/60 px-3 py-2 text-sm">
                <span className="min-w-[160px] flex-1 font-medium text-navy">{l.name}{l.format ? <span className="ml-1.5 rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-navy/80">{l.format}</span> : null}</span>
                <label className="text-xs text-navy/70">Qté <input type="number" min={1} value={l.qty} onChange={(e) => upd(l.key, { qty: Math.max(1, Number(e.target.value) || 1) })} className="ml-1 w-16 rounded-lg border border-line bg-white px-2 py-1 text-sm" /></label>
                <label className="text-xs text-navy/70">Prix unitaire <input type="number" min={0} value={l.unitPrice} onChange={(e) => upd(l.key, { unitPrice: Math.max(0, Number(e.target.value) || 0) })} className="ml-1 w-28 rounded-lg border border-line bg-white px-2 py-1 text-sm" /></label>
                <span className="w-28 text-right font-semibold text-navy">{fmt(l.qty * l.unitPrice)}</span>
                <button type="button" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} aria-label="Retirer" className="rounded-lg p-1.5 text-navy/60 hover:bg-white hover:text-red-700"><Trash2 size={15} /></button>
              </div>
            ))}
            <p className="text-right text-sm text-navy/80">Valeur des produits : <strong>{fmt(linesTotal)}</strong></p>
          </div>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-semibold text-navy">
            3. Montant du crédit (F)
            <input name="amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))} placeholder={linesTotal ? `${linesTotal} (valeur des produits)` : "ex. 150000"} className={`${field} mt-1.5 text-base`} />
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            {QUICK.map((q) => (
              <button key={q} type="button" onClick={() => setAmount(String(q))} className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-navy hover:border-navy">{q / 1000}k</button>
            ))}
            {linesTotal > 0 && <button type="button" onClick={() => setAmount(String(linesTotal))} className="rounded-full border border-navy px-3 py-1 text-xs font-semibold text-navy">= produits</button>}
          </div>
        </div>
        <label className="text-sm font-semibold text-navy">
          Échéance <span className="font-normal text-navy/60">(facultatif)</span>
          <input type="date" name="dueDate" className={`${field} mt-1.5`} />
        </label>
        <label className="text-sm font-semibold text-navy sm:col-span-2">
          Description du lot <span className="font-normal text-navy/60">(facultatif)</span>
          <textarea name="notes" maxLength={500} rows={2} placeholder="ex. Lot de rentrée : 20 parfums 50 ml" className={`${field} mt-1.5`} />
        </label>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending || !who} className="rounded-full bg-navy px-6 py-2.5 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-50">
          {pending ? "Enregistrement…" : `Accorder ${amount ? fmt(Number(amount)) : linesTotal ? fmt(linesTotal) : "le crédit"}`}
        </button>
        {!who && <span className="text-xs text-navy/60">Choisissez d&apos;abord le revendeur.</span>}
        {state.error && <p role="alert" className="w-full text-sm font-medium text-red-700">{state.error}</p>}
        {state.ok && <p role="status" className="w-full text-sm font-medium text-emerald-800">{state.message}</p>}
      </div>
    </form>
  );
}
