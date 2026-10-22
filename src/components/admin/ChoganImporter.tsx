"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { splitBatch } from "@/lib/chogan/query";
import { formatPrice } from "@/lib/currency";
import { importChoganProduct, refreshChoganPhotos, resolveChoganQuery, type ResolveResult } from "@/lib/actions/chogan-import";
import type { ChoganPreview } from "@/lib/chogan/preview";

type Category = { slug: string; label: string };
type Edit = { name: string; category: string; shortDescription: string; longDescription: string };
type ImportState = { kind: "idle" } | { kind: "busy" } | { kind: "done"; id: string; slug: string } | { kind: "error"; message: string };
type Row = {
  key: string;
  query: string;
  result: ResolveResult | null;
  loading: boolean;
  selected: boolean;
  edit: Edit | null;
  importState: ImportState;
  photoMessage?: string;
  /** Même fiche Chogan qu'une ligne précédente du lot : décochée pour ne pas créer de doublon. */
  duplicateOf?: string;
};

const MAX = 50;
const ZIP_CHUNK = 10;

const editFrom = (p: ChoganPreview): Edit => ({ name: p.name, category: p.category, shortDescription: p.shortDescription, longDescription: p.longDescription.join("\n\n") });
const eur = (n: number) => `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

const badge = (r: Row) => {
  if (r.loading) return ["Recherche…", "bg-cream text-navy/70"];
  if (r.importState.kind === "done") return ["Fiche créée", "bg-emerald-100 text-emerald-800"];
  if (!r.result) return ["En attente", "bg-cream text-navy/60"];
  switch (r.result.status) {
    case "found":
      return ["Trouvé", "bg-emerald-50 text-emerald-800"];
    case "exists":
      return ["Déjà au catalogue", "bg-navy/10 text-navy"];
    case "choose":
      return ["À préciser", "bg-amber-100 text-amber-900"];
    case "notfound":
      return ["Introuvable", "bg-rose/15 text-rose-dark"];
    default:
      return ["Erreur", "bg-rose/15 text-rose-dark"];
  }
};

export function ChoganImporter({ categories }: { categories: Category[] }) {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [phase, setPhase] = useState<"idle" | "searching" | "importing">("idle");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const stopRef = useRef(false);

  const queries = splitBatch(text, MAX);
  const patch = (key: string, p: Partial<Row> | ((r: Row) => Partial<Row>)) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...(typeof p === "function" ? p(r) : p) } : r)));

  async function resolveRow(key: string, query: string) {
    patch(key, { loading: true });
    let result: ResolveResult;
    try {
      result = await resolveChoganQuery(query);
    } catch {
      result = { status: "error", message: "Le serveur n'a pas répondu. Réessayez." };
    }
    const preview = result.status === "found" ? result.preview : null;
    setRows((rs) => {
      const twin = preview ? rs.find((o) => o.key !== key && o.result?.status === "found" && o.result.preview.number === preview.number) : undefined;
      return rs.map((r) => (r.key === key ? { ...r, loading: false, result, edit: preview ? editFrom(preview) : null, selected: !!preview && !twin, duplicateOf: twin?.query } : r));
    });
  }

  async function search() {
    const qs = splitBatch(text, MAX);
    if (!qs.length) return;
    stopRef.current = false;
    const fresh: Row[] = qs.map((q, i) => ({ key: `${Date.now()}-${i}`, query: q, result: null, loading: false, selected: false, edit: null, importState: { kind: "idle" } }));
    setRows(fresh);
    setPhase("searching");
    setProgress({ done: 0, total: fresh.length });
    for (const [i, row] of fresh.entries()) {
      if (stopRef.current) break;
      await resolveRow(row.key, row.query);
      setProgress({ done: i + 1, total: fresh.length });
    }
    setPhase("idle");
  }

  /** Recherche large : ajoute au lot toutes les fiches Chogan absentes du catalogue, puis les prépare. */
  async function addMissing(fromKey: string, missing: { number: number; name: string }[]) {
    const known = new Set(rows.map((r) => (r.result?.status === "found" ? r.result.preview.number : null)).filter(Boolean));
    const fresh: Row[] = missing
      .filter((m) => !known.has(m.number))
      .slice(0, MAX)
      .map((m, i) => ({ key: `${Date.now()}-m${i}`, query: String(m.number), result: null, loading: false, selected: false, edit: null, importState: { kind: "idle" } }));
    if (!fresh.length) return;
    setRows((rs) => [...rs.filter((r) => r.key !== fromKey), ...fresh]);
    stopRef.current = false;
    setPhase("searching");
    setProgress({ done: 0, total: fresh.length });
    for (const [i, row] of fresh.entries()) {
      if (stopRef.current) break;
      await resolveRow(row.key, row.query);
      setProgress({ done: i + 1, total: fresh.length });
    }
    setPhase("idle");
  }

  async function importSelected() {
    const targets = rows.filter((r) => r.selected && r.result?.status === "found" && r.edit && r.importState.kind !== "done");
    if (!targets.length) return;
    stopRef.current = false;
    setPhase("importing");
    setProgress({ done: 0, total: targets.length });
    for (const [i, r] of targets.entries()) {
      if (stopRef.current) break;
      if (r.result?.status !== "found" || !r.edit) continue;
      patch(r.key, { importState: { kind: "busy" } });
      try {
        const res = await importChoganProduct({
          number: r.result.preview.number,
          name: r.edit.name,
          category: r.edit.category,
          shortDescription: r.edit.shortDescription,
          longDescription: r.edit.longDescription.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean),
        });
        patch(r.key, { importState: res.ok ? { kind: "done", id: res.id, slug: res.slug } : { kind: "error", message: res.error }, selected: !res.ok });
      } catch {
        patch(r.key, { importState: { kind: "error", message: "Le serveur n'a pas répondu. Réessayez." } });
      }
      setProgress({ done: i + 1, total: targets.length });
    }
    setPhase("idle");
  }

  async function refreshPhotos(r: Row) {
    if (r.result?.status !== "exists") return;
    patch(r.key, { photoMessage: "Mise à jour des photos…" });
    const res = await refreshChoganPhotos(r.result.existing.id, r.result.preview?.number).catch(() => ({ ok: false, error: "Le serveur n'a pas répondu." }) as { ok: boolean; error?: string; count?: number });
    patch(r.key, { photoMessage: res.ok ? `${res.count} photo(s) mises à jour.` : res.error ?? "Échec." });
  }

  const busy = phase !== "idle";
  const selectable = rows.filter((r) => r.result?.status === "found" && r.importState.kind !== "done");
  const selectedCount = selectable.filter((r) => r.selected).length;
  const zipNumbers = [...new Set(rows.flatMap((r) => (r.result?.status === "found" || (r.result?.status === "exists" && r.result.preview) ? [r.result.preview!.number] : [])))];
  const zipChunks = Array.from({ length: Math.ceil(zipNumbers.length / ZIP_CHUNK) }, (_, i) => zipNumbers.slice(i * ZIP_CHUNK, (i + 1) * ZIP_CHUNK));
  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    const k = r.importState.kind === "done" ? "created" : r.result?.status ?? "pending";
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-line bg-white p-5 sm:p-6">
        <label htmlFor="chogan-batch" className="text-sm font-semibold text-navy">
          Produits à importer
        </label>
        <p className="mt-1 text-xs text-navy/65">
          Un produit par ligne : code (MM041), n° de fiche (9479), lien de fiche Chogan ou nom (« Blush &amp; Kiss Peach »). Plusieurs codes ou n° peuvent tenir sur une ligne, séparés par des espaces ou des virgules. {MAX} au plus par lot.
        </p>
        <textarea
          id="chogan-batch"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          disabled={busy}
          placeholder={"MM041, MM042\n9479\nhttps://www.chogangroupspa.com/chogangroup/productDetail/16201\nBlush & Kiss Peach"}
          className="mt-3 w-full rounded-xl border border-line bg-cream/40 p-3 font-mono text-sm text-navy outline-none focus:border-rose-dark focus:bg-white"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" onClick={search} disabled={busy || !queries.length} className="rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-50">
            {phase === "searching" ? `Recherche ${progress.done}/${progress.total}…` : `Rechercher ${queries.length ? `(${queries.length})` : ""}`}
          </button>
          {busy && (
            <button type="button" onClick={() => (stopRef.current = true)} className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-navy hover:bg-cream">
              Arrêter après la ligne en cours
            </button>
          )}
          {!busy && rows.length > 0 && (
            <button type="button" onClick={() => setRows([])} className="text-sm font-semibold text-navy/70 hover:underline">
              Effacer les résultats
            </button>
          )}
        </div>
      </section>

      {rows.length > 0 && (
        <section aria-live="polite" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white px-5 py-4 text-sm text-navy">
          <p>
            {[
              counts.found && `${counts.found} trouvé(s)`,
              counts.created && `${counts.created} créé(s)`,
              counts.exists && `${counts.exists} déjà au catalogue`,
              counts.choose && `${counts.choose} à préciser`,
              (counts.notfound || counts.error) && `${(counts.notfound ?? 0) + (counts.error ?? 0)} en échec`,
            ]
              .filter(Boolean)
              .join(" · ") || "Recherche en cours…"}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {zipChunks.map((chunk, i) => (
              <a key={chunk.join(",")} href={`/api/admin/chogan-photos?n=${chunk.join(",")}`} className="rounded-full border border-line px-4 py-2 font-semibold hover:bg-cream">
                Télécharger les photos (ZIP{zipChunks.length > 1 ? ` ${i + 1}/${zipChunks.length}` : ""})
              </a>
            ))}
            <button type="button" onClick={importSelected} disabled={busy || !selectedCount} className="rounded-full bg-rose-dark px-5 py-2 font-semibold text-white hover:opacity-90 disabled:opacity-50">
              {phase === "importing" ? `Création ${progress.done}/${progress.total}…` : `Créer les fiches (${selectedCount})`}
            </button>
          </div>
        </section>
      )}

      <ol className="space-y-4">
        {rows.map((r) => {
          const [label, cls] = badge(r);
          const res = r.result;
          const preview = res && (res.status === "found" || res.status === "exists") ? res.preview : null;
          return (
            <li key={r.key} className="rounded-2xl border border-line bg-white p-5" data-testid="chogan-row">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs text-navy/60">{r.query}</p>
                  {preview && (
                    <p className="mt-1 text-sm text-navy/80">
                      Code <strong>{preview.code}</strong> · fiche Chogan{" "}
                      <a href={preview.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-rose-dark hover:underline">
                        n° {preview.number}
                      </a>
                      {preview.format ? ` · ${preview.format}` : ""}
                      {preview.brand ? ` · ${preview.brand}` : ""}
                    </p>
                  )}
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${cls}`}>{label}</span>
              </div>

              {preview && preview.images.length > 0 && (
                <div className="mt-3 flex gap-2 overflow-x-auto">
                  {preview.images.map((src, i) => (
                    <a key={src} href={src} target="_blank" rel="noopener noreferrer" className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-line bg-cream/40">
                      <Image src={src} alt={`${preview.name} — photo ${i + 1}`} fill sizes="80px" className="object-contain" />
                    </a>
                  ))}
                </div>
              )}

              {res?.status === "found" && r.edit && r.importState.kind !== "done" && (
                <div className="mt-4 grid gap-3 lg:grid-cols-[auto_1fr]">
                  <label className="flex items-center gap-2 text-sm font-semibold text-navy lg:col-span-2">
                    <input type="checkbox" checked={r.selected} disabled={busy} onChange={(e) => patch(r.key, { selected: e.target.checked })} className="h-4 w-4 accent-[#1d2f4f]" />
                    Créer cette fiche
                  </label>
                  {r.duplicateOf && <p className="text-sm text-amber-900 lg:col-span-2">Même produit que la ligne « {r.duplicateOf} » : décochée pour éviter un doublon.</p>}
                  <p className="text-sm text-navy/80 lg:col-span-2">
                    Prix public Chogan {eur(res.preview.publicPriceEur)} = {formatPrice(res.preview.publicPrice)} · prix de vente JAMAAL <strong>{formatPrice(res.preview.regularPrice)}</strong>
                    {res.preview.volumes ? ` · formats : ${res.preview.volumes.map((v) => `${v.label} ${formatPrice(v.price)}`).join(", ")}` : ""}
                  </p>
                  <label className="text-xs font-semibold text-navy/80 lg:pt-2">Nom</label>
                  <input value={r.edit.name} disabled={busy} onChange={(e) => patch(r.key, (x) => ({ edit: { ...x.edit!, name: e.target.value } }))} className="rounded-lg border border-line px-3 py-2 text-sm text-navy" />
                  <label className="text-xs font-semibold text-navy/80 lg:pt-2">Catégorie</label>
                  <select value={r.edit.category} disabled={busy} onChange={(e) => patch(r.key, (x) => ({ edit: { ...x.edit!, category: e.target.value } }))} className="rounded-lg border border-line px-3 py-2 text-sm text-navy">
                    {!categories.some((c) => c.slug === r.edit!.category) && <option value={r.edit.category}>{r.edit.category} (à créer)</option>}
                    {categories.map((c) => (
                      <option key={c.slug} value={c.slug}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <label className="text-xs font-semibold text-navy/80 lg:pt-2">Résumé</label>
                  <textarea value={r.edit.shortDescription} rows={2} disabled={busy} onChange={(e) => patch(r.key, (x) => ({ edit: { ...x.edit!, shortDescription: e.target.value } }))} className="rounded-lg border border-line px-3 py-2 text-sm text-navy" />
                  <label className="text-xs font-semibold text-navy/80 lg:pt-2">Description</label>
                  <textarea value={r.edit.longDescription} rows={5} disabled={busy} onChange={(e) => patch(r.key, (x) => ({ edit: { ...x.edit!, longDescription: e.target.value } }))} className="rounded-lg border border-line px-3 py-2 text-sm text-navy" />
                  {r.importState.kind === "busy" && <p className="text-sm text-navy/70 lg:col-span-2">Création de la fiche et copie des photos…</p>}
                  {r.importState.kind === "error" && <p className="text-sm text-rose-dark lg:col-span-2">{r.importState.message}</p>}
                </div>
              )}

              {r.importState.kind === "done" && (
                <p className="mt-3 text-sm text-emerald-800">
                  Fiche créée (stock 0) :{" "}
                  <Link href={`/admin/produits/${r.importState.id}/modifier`} className="font-semibold hover:underline">
                    modifier
                  </Link>{" "}
                  ·{" "}
                  <a href={`/produits/${r.importState.slug}`} target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline">
                    voir sur le site
                  </a>
                </p>
              )}

              {res?.status === "exists" && (
                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-navy">
                  <span>
                    Fiche JAMAAL : <strong>{res.existing.name}</strong> ({1 + res.existing.galleryCount > 1 ? `${1 + res.existing.galleryCount} photos` : res.existing.photo ? "1 photo" : "sans photo"})
                  </span>
                  <Link href={`/admin/produits/${res.existing.id}/modifier`} className="font-semibold text-rose-dark hover:underline">
                    Ouvrir
                  </Link>
                  {preview && (
                    <button type="button" onClick={() => refreshPhotos(r)} disabled={busy} className="rounded-full border border-line px-3 py-1.5 font-semibold hover:bg-cream disabled:opacity-50">
                      Mettre à jour les photos ({preview.images.length})
                    </button>
                  )}
                  {r.photoMessage && <span className="text-navy/70">{r.photoMessage}</span>}
                </div>
              )}

              {res?.status === "choose" && (
                <div className="mt-3">
                  <p className="text-sm text-navy/80">{res.message ?? "Plusieurs produits correspondent : choisissez le bon."}</p>
                  {!!res.missing?.length && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                      <span><strong>{res.missing.length}</strong> produit{res.missing.length > 1 ? "s" : ""} sur {res.total} {res.missing.length > 1 ? "ne sont" : "n'est"} pas encore au catalogue JAMAAL (nouveautés).</span>
                      <button type="button" disabled={busy || r.loading} onClick={() => addMissing(r.key, res.missing!)} className="rounded-full bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">
                        Préparer ces {res.missing.length} fiches
                      </button>
                    </div>
                  )}
                  <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {res.candidates.map((c) => (
                      <li key={c.number} className="flex items-center gap-3 rounded-xl border border-line p-2">
                        {c.image && (
                          <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-cream/40">
                            <Image src={c.image} alt="" fill sizes="56px" className="object-contain" />
                          </span>
                        )}
                        <span className="min-w-0 flex-1 text-xs text-navy">
                          <strong className="block truncate">{c.name}</strong>
                          {c.code} · n° {c.number}
                          {c.format ? ` · ${c.format}` : ""}
                          {c.existingId ? " · déjà au catalogue" : ""}
                        </span>
                        <button type="button" disabled={busy || r.loading} onClick={() => resolveRow(r.key, String(c.number))} className="rounded-full bg-navy px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                          Choisir
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {(res?.status === "notfound" || res?.status === "error") && <p className="mt-3 text-sm text-rose-dark">{res.message}</p>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
