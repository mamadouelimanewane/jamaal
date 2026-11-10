"use client";

import { useState } from "react";
import { joinGroupDeal } from "@/lib/actions/group-deals";

export function GroupDealJoinForm({ dealId, title, initialCount, targetCount, discountPct }: { dealId: string; title: string; initialCount: number; targetCount: number; discountPct: number }) {
  const [count, setCount] = useState(initialCount);
  const [error, setError] = useState("");
  const [coupon, setCoupon] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(form: FormData) {
    setBusy(true); setError("");
    try {
      const result = await joinGroupDeal(dealId, { name: String(form.get("name")), phone: String(form.get("phone")) });
      if (!result.ok) setError(result.error);
      else { setCount(result.joined ?? count); setCoupon(result.couponCode ?? ""); }
    } catch { setError("Une erreur est survenue. Réessayez."); } finally { setBusy(false); }
  }
  const shareUrl = typeof window === "undefined" ? "" : window.location.href;
  return <div className="space-y-4">
    <div><div className="mb-2 flex justify-between text-sm"><span>{count} participant{count > 1 ? "s" : ""}</span><span>{targetCount} nécessaires</span></div><div className="h-3 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-[#202e54] transition-all" style={{ width: `${Math.min(100, count / targetCount * 100)}%` }} /></div></div>
    {coupon ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><h3 className="font-semibold text-emerald-900">Votre remise de {discountPct}% est débloquée</h3><p className="mt-1 text-sm">Utilisez ce code au paiement. Il est personnel et utilisable une fois.</p><div className="mt-3 flex gap-2"><code className="rounded bg-white px-3 py-2 font-bold tracking-wider">{coupon}</code><button onClick={() => navigator.clipboard.writeText(coupon)} className="rounded border px-3">Copier</button><a href={`/panier?coupon=${encodeURIComponent(coupon)}`} className="rounded bg-[#202e54] px-3 py-2 text-white">Voir le panier</a></div></div> : <>
      <p className="text-sm text-slate-700">Rejoignez le groupe. Quand {targetCount} personnes l’auront rejoint, chacun recevra un code de réduction de {discountPct}% pour commander séparément.</p>
      <form action={submit} className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Votre nom<input name="name" required minLength={2} maxLength={80} autoComplete="name" className="mt-1 w-full rounded-lg border p-3" /></label><label className="text-sm">Téléphone<input name="phone" required type="tel" autoComplete="tel" placeholder="77 000 00 00" className="mt-1 w-full rounded-lg border p-3" /></label><button disabled={busy} className="rounded-xl bg-[#202e54] px-4 py-3 font-semibold text-white disabled:opacity-60 sm:col-span-2">{busy ? "Inscription…" : "Rejoindre l’achat groupé"}</button></form>
    </>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <a href={`https://wa.me/?text=${encodeURIComponent(`Rejoignez notre achat groupé : ${title} ${shareUrl}`)}`} target="_blank" rel="noreferrer" className="inline-flex rounded-lg border border-green-700 px-4 py-2 text-sm font-medium text-green-800">Inviter sur WhatsApp</a>
    <p className="text-xs text-slate-500">Chaque participant paie sa propre commande. La participation ne réserve pas le stock et l’offre doit atteindre son objectif avant son expiration.</p>
  </div>;
}
