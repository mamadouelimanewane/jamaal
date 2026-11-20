"use client";

import { useActionState, useMemo, useState } from "react";
import { Megaphone, MessageCircle, X } from "lucide-react";
import { sendTargetedAnnouncement, type TargetedState } from "@/lib/actions/announcements";
import { getShopTheme } from "@/lib/shop/themes";
import { KINDS, SEGMENTS, TEMPLATES, VARIABLES, inSegment, renderOutreach, waHref, type OutreachKind, type SegmentKey } from "@/lib/reseller-outreach";
import type { ResellerStatRow } from "@/lib/shop/shop-stats-store";

const F = (n: number) => n.toLocaleString("fr-FR");
const field = "w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-navy focus:ring-2 focus:ring-navy/10";
const since = (iso: string | null, now: number) => {
  if (!iso) return "jamais";
  const d = Math.floor((now - new Date(iso).getTime()) / 86_400_000);
  return d <= 0 ? "aujourd'hui" : d === 1 ? "hier" : `il y a ${d} j`;
};

/** Statistiques par revendeur + sélection par groupe + annonce personnalisée aux revendeurs choisis. */
export function ResellerOutreach({ rows, days, origin }: { rows: ResellerStatRow[]; days: number; origin: string }) {
  const [now] = useState(() => Date.now());
  const [segment, setSegment] = useState<SegmentKey>("tous");
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [composing, setComposing] = useState(false);
  const [kind, setKind] = useState<OutreachKind>("RAPPEL");
  const [title, setTitle] = useState(TEMPLATES.RAPPEL.title);
  const [body, setBody] = useState(TEMPLATES.RAPPEL.body);
  const [state, action, pending] = useActionState(async (prev: TargetedState, fd: FormData) => {
    const r = await sendTargetedAnnouncement(prev, fd);
    if (r.ok) setComposing(false);
    return r;
  }, { ok: false } as TargetedState);

  const counts = useMemo(() => Object.fromEntries(SEGMENTS.map((s) => [s.key, inSegment(rows, s.key).length])), [rows]);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    const list = inSegment(rows, segment);
    return t ? list.filter((r) => `${r.name} ${r.city}`.toLowerCase().includes(t)) : list;
  }, [rows, segment, q]);
  const allShownPicked = shown.length > 0 && shown.every((r) => picked.has(r.id));
  const chosen = rows.filter((r) => picked.has(r.id));
  const preview = chosen[0] ?? shown[0];

  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const pickShown = () => setPicked((p) => { const n = new Set(p); if (allShownPicked) shown.forEach((r) => n.delete(r.id)); else shown.forEach((r) => n.add(r.id)); return n; });
  const chooseKind = (k: OutreachKind) => {
    setKind(k);
    setTitle(TEMPLATES[k].title);
    setBody(TEMPLATES[k].body);
  };
  const quickSelect = (k: SegmentKey, tpl: OutreachKind) => {
    setSegment(k);
    setPicked(new Set(inSegment(rows, k).map((r) => r.id)));
    chooseKind(tpl);
    setComposing(true);
  };

  return (
    <section className="rounded-2xl border border-line bg-white">
      <div className="border-b border-line p-5">
        <h2 className="text-sm font-semibold text-navy">Par revendeur</h2>
        <p className="mt-1 text-xs text-navy/65">Choisissez un groupe, cochez les revendeurs, puis envoyez-leur un message personnalisé. Il arrive dans leur « Ma communication » avec une notification ; vous pouvez aussi l&apos;envoyer sur WhatsApp.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {SEGMENTS.map((s) => (
            <button key={s.key} type="button" title={s.hint} onClick={() => setSegment(s.key)} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${segment === s.key ? "bg-navy text-white" : "bg-cream text-navy hover:bg-cream/70"}`}>
              {s.label} <span className="opacity-70">{counts[s.key]}</span>
            </button>
          ))}
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom ou ville" className="ml-auto w-48 rounded-full border border-line px-3 py-1.5 text-sm" />
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="self-center text-navy/60">Raccourcis :</span>
          <button type="button" onClick={() => quickSelect("inactifs", "AVERTISSEMENT")} className="rounded-full border border-red-200 bg-red-50 px-3 py-1 font-semibold text-red-800 hover:border-red-400">Avertir les inactifs ({counts.inactifs})</button>
          <button type="button" onClick={() => quickSelect("sans-vente", "RAPPEL")} className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 font-semibold text-amber-900 hover:border-amber-400">Relancer « visites sans vente » ({counts["sans-vente"]})</button>
          <button type="button" onClick={() => quickSelect("top", "FELICITATIONS")} className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-semibold text-emerald-800 hover:border-emerald-400">Féliciter le top 10 ({counts.top})</button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-sm">
          <thead className="bg-cream/50 text-left text-xs uppercase tracking-wider text-navy/60">
            <tr>
              <th className="w-10 px-4 py-2"><input type="checkbox" aria-label="Tout cocher" checked={allShownPicked} onChange={pickShown} className="h-4 w-4 accent-[#1d2f4f]" /></th>
              <th className="py-2 pr-3">Revendeur</th>
              <th className="py-2 pr-3">Thème</th>
              <th className="py-2 pr-3 text-right">Visiteurs</th>
              <th className="py-2 pr-3 text-right">WhatsApp</th>
              <th className="py-2 pr-3 text-right">Produits</th>
              <th className="py-2 pr-3 text-right">Ventes</th>
              <th className="py-2 pr-3 text-right">CA</th>
              <th className="py-2 pr-4">Dernière activité</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {shown.map((r) => (
              <tr key={r.id} className={picked.has(r.id) ? "bg-cream/60" : ""}>
                <td className="px-4 py-2.5"><input type="checkbox" aria-label={`Choisir ${r.name}`} checked={picked.has(r.id)} onChange={() => toggle(r.id)} className="h-4 w-4 accent-[#1d2f4f]" /></td>
                <td className="py-2.5 pr-3">
                  {r.slug ? <a href={`/c/${r.slug}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-navy hover:underline">{r.name}</a> : <span className="font-semibold text-navy">{r.name}</span>}
                  <span className="block text-xs text-navy/60">{r.city}{!r.slug ? " · pas encore de boutique" : r.ready ? "" : " · boutique à compléter (photo, coups de cœur)"}</span>
                </td>
                <td className="py-2.5 pr-3 text-navy/80">{r.slug ? getShopTheme(r.theme).name : "—"}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums">{F(r.visitors)}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums">{F(r.whatsappClicks)}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums">{F(r.products)}</td>
                <td className="py-2.5 pr-3 text-right tabular-nums">{F(r.sales)}</td>
                <td className="whitespace-nowrap py-2.5 pr-3 text-right tabular-nums">{F(r.salesAmount)} F</td>
                <td className={`py-2.5 pr-4 text-xs ${!r.lastActivity || now - new Date(r.lastActivity).getTime() > 30 * 86_400_000 ? "font-semibold text-red-700" : "text-navy/70"}`}>{since(r.lastActivity, now)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!shown.length && <p className="px-5 py-8 text-center text-sm text-navy/65">Aucun revendeur dans ce groupe.</p>}
      </div>

      {picked.size > 0 && !composing && (
        <div className="sticky bottom-3 z-20 mx-3 mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-navy px-5 py-3 text-white shadow-lg">
          <span className="text-sm"><strong>{picked.size}</strong> revendeur(s) sélectionné(s)</span>
          <div className="flex gap-2">
            <button type="button" onClick={() => setPicked(new Set())} className="rounded-full px-3 py-1.5 text-sm text-white/80 hover:text-white">Vider</button>
            <button type="button" onClick={() => setComposing(true)} className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-navy"><Megaphone size={15} /> Envoyer un message</button>
          </div>
        </div>
      )}

      {composing && (
        <form action={action} className="m-3 space-y-4 rounded-2xl border-2 border-navy bg-white p-5">
          <input type="hidden" name="ids" value={JSON.stringify([...picked])} />
          <input type="hidden" name="days" value={days} />
          <input type="hidden" name="kind" value={kind} />
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-navy">Message à {picked.size} revendeur(s)</h3>
              <p className="text-xs text-navy/65">Chiffres des {days} derniers jours. Variables remplacées pour chacun : {VARIABLES.join(" ")}</p>
            </div>
            <button type="button" onClick={() => setComposing(false)} aria-label="Fermer" className="rounded-lg p-1.5 text-navy/60 hover:bg-cream"><X size={18} /></button>
          </div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(KINDS) as OutreachKind[]).map((k) => (
              <button key={k} type="button" onClick={() => chooseKind(k)} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${kind === k ? "bg-navy text-white" : "bg-cream text-navy"}`}>{KINDS[k]}</button>
            ))}
          </div>
          <label className="block text-xs font-semibold text-navy/85">Titre<input name="title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120} className={`${field} mt-1`} /></label>
          <label className="block text-xs font-semibold text-navy/85">Message<textarea name="body" value={body} onChange={(e) => setBody(e.target.value)} required rows={7} maxLength={3000} className={`${field} mt-1`} /></label>
          <label className="flex items-center gap-2 text-sm text-navy/85"><input type="checkbox" name="pinned" className="h-4 w-4 accent-[#1d2f4f]" /> Épingler en haut de leur liste</label>
          {preview && (
            <div className="rounded-xl bg-cream/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-navy/60">Aperçu pour {preview.name}</p>
              <p className="mt-1 font-semibold text-navy">{renderOutreach(title, preview, days, origin)}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-navy/85">{renderOutreach(body, preview, days, origin)}</p>
            </div>
          )}
          {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
          <button disabled={pending} className="rounded-full bg-navy px-6 py-2.5 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-50">{pending ? "Envoi…" : `Envoyer à ${picked.size} revendeur(s)`}</button>
        </form>
      )}

      {state.ok && state.sent && (
        <div className="m-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="font-semibold text-emerald-900">Message envoyé à {state.sent.length} revendeur(s) : il est dans leur « Ma communication », avec une notification.</p>
          <p className="mt-1 text-sm text-emerald-900/80">Pour l&apos;envoyer aussi sur WhatsApp, ouvrez chaque conversation (le message personnalisé est prêt, il part de votre téléphone) :</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {state.sent.map((s) => {
              const href = waHref(s.whatsapp, s.text);
              return (
                <li key={s.id} className="flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 text-sm">
                  <span className="font-medium text-navy">{s.name}</span>
                  {href ? (
                    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-[#25D366] px-3 py-1 text-xs font-semibold text-white"><MessageCircle size={13} /> WhatsApp</a>
                  ) : (
                    <span className="text-xs text-navy/50">pas de numéro</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
