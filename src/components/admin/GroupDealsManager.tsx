"use client";

import { useState } from "react";
import { createGroupDeal } from "@/lib/actions/group-deals";

type ProductOption = { id: string; name: string; volumes: { label: string; price?: number }[] };
type DealRow = { id: string; title: string; status: string; targetCount: number; discountPct: number; expiresAt: Date; _count: { participants: number } };

export function GroupDealsManager({ products, deals, origin, slug }: { products: ProductOption[]; deals: DealRow[]; origin: string; slug: string | null }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [url, setUrl] = useState("");
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const selected = products.find((p) => p.id === productId);
  async function submit(form: FormData) {
    setBusy(true); setMessage(""); setUrl("");
    try {
      const result = await createGroupDeal({ title: String(form.get("title")), description: String(form.get("description")), productId, volumeLabel: String(form.get("volumeLabel")), targetCount: Number(form.get("targetCount")), discountPct: Number(form.get("discountPct")), days: Number(form.get("days")) });
      if (!result.ok) setMessage(result.error); else { setUrl(result.url ?? ""); setMessage("Offre créée. Partagez le lien pour réunir les participants."); }
    } catch { setMessage("Impossible de créer l’offre pour le moment."); } finally { setBusy(false); }
  }
  const share = (link: string, title: string) => `https://wa.me/?text=${encodeURIComponent(`${title} — rejoignez cette offre Jamaal : ${link}`)}`;
  return <div className="space-y-8">
    <section className="rounded-2xl border bg-white p-5 shadow-sm"><h2 className="text-lg font-semibold">Créer une offre groupée</h2><p className="mt-1 text-sm text-slate-600">Choisissez un produit, fixez un objectif de participants et partagez le lien. La remise est débloquée lorsque l’objectif est atteint.</p>
      {products.length ? <form action={submit} className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="text-sm">Nom de l’offre<input name="title" required minLength={4} maxLength={80} placeholder="Ex. Achat groupé parfum" className="mt-1 w-full rounded-lg border p-2.5" /></label>
        <label className="text-sm">Produit<select value={productId} onChange={(e) => setProductId(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5">{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label className="text-sm">Format<select name="volumeLabel" required className="mt-1 w-full rounded-lg border p-2.5">{(selected?.volumes ?? []).map((v) => <option key={v.label} value={v.label}>{v.label}{v.price ? ` — ${v.price.toLocaleString("fr-FR")} FCFA` : ""}</option>)}</select></label>
        <label className="text-sm">Participants nécessaires<input name="targetCount" type="number" min="2" max="30" defaultValue="5" className="mt-1 w-full rounded-lg border p-2.5" /></label>
        <label className="text-sm">Remise débloquée<input name="discountPct" type="number" min="5" max="40" defaultValue="10" className="mt-1 w-full rounded-lg border p-2.5" /></label>
        <label className="text-sm">Durée (jours)<input name="days" type="number" min="1" max="14" defaultValue="7" className="mt-1 w-full rounded-lg border p-2.5" /></label>
        <label className="text-sm md:col-span-2">Description (facultatif)<textarea name="description" maxLength={280} rows={2} className="mt-1 w-full rounded-lg border p-2.5" /></label>
        <button disabled={busy} className="rounded-xl bg-[#202e54] px-5 py-3 font-semibold text-white disabled:opacity-60 md:col-span-2">{busy ? "Création…" : "Créer et obtenir le lien"}</button>
      </form> : <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm">Aucun produit avec format disponible ne peut être proposé actuellement.</p>}
      {message && <p className="mt-4 text-sm" role="status">{message}</p>}{url && <div className="mt-3 flex flex-wrap gap-2"><input readOnly value={url} className="min-w-0 flex-1 rounded-lg border p-2"/><button onClick={() => navigator.clipboard.writeText(url)} className="rounded-lg border px-4 py-2">Copier</button><a href={share(url, "Offre groupée Jamaal")} target="_blank" rel="noreferrer" className="rounded-lg bg-green-700 px-4 py-2 text-white">Partager sur WhatsApp</a></div>}
    </section>
    <section><h2 className="mb-3 text-lg font-semibold">Mes offres</h2>{deals.length ? <div className="space-y-3">{deals.map((d) => { const link = `${origin}/achat-groupe/${d.id}${slug ? `?ref=${encodeURIComponent(slug)}` : ""}`; return <article key={d.id} className="rounded-xl border bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold">{d.title}</h3><p className="text-sm text-slate-600">{d._count.participants}/{d.targetCount} participants · {d.discountPct}% · expire le {new Date(d.expiresAt).toLocaleDateString("fr-FR")}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs">{d.status === "ATTEINT" ? "Objectif atteint" : d.status === "OPEN" ? "En cours" : "Terminée"}</span></div><div className="mt-3 flex gap-2"><a href={share(link,d.title)} target="_blank" rel="noreferrer" className="rounded-lg bg-green-700 px-3 py-2 text-sm text-white">Partager WhatsApp</a><button onClick={() => navigator.clipboard.writeText(link)} className="rounded-lg border px-3 py-2 text-sm">Copier le lien</button></div></article>; })}</div> : <p className="rounded-xl border border-dashed p-6 text-sm text-slate-600">Vous n’avez pas encore créé d’offre groupée.</p>}</section>
    <p className="text-xs text-slate-500">Chaque participant passe sa propre commande et paie séparément. Le stock n’est pas réservé avant le paiement.</p>
  </div>;
}
