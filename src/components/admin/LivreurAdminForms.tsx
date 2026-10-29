"use client";

import { startTransition, useActionState, useState } from "react";
import { compressPhoto } from "@/lib/compress-photo";
import { ID_TYPES, needsVerso } from "@/lib/livreur-signup";
import type { DocUploadState } from "@/lib/actions/livreur-signup";
import type { CashState } from "@/lib/actions/delivery";

const field = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-navy";

/** Ajout / remplacement de la pièce d'identité par l'administrateur. */
export function LivreurDocForm({ action, idType, idNumber }: { action: (prev: DocUploadState, fd: FormData) => Promise<DocUploadState>; idType: string | null; idNumber: string | null }) {
  const [state, run, pending] = useActionState(action, null);
  const [type, setType] = useState(idType ?? "CNI");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    for (const k of ["idRecto", "idVerso"]) {
      const f = fd.get(k);
      if (f instanceof File && f.size && f.type.startsWith("image/") && !/heic|heif/.test(f.type)) {
        const b = await compressPhoto(f);
        fd.set(k, b instanceof File ? b : new File([b], `${k}.jpg`, { type: b.type || "image/jpeg" }));
      }
    }
    setBusy(false);
    startTransition(() => run(fd));
  }
  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm font-medium text-ink">Type de pièce
        <select name="idType" value={type} onChange={(e) => setType(e.target.value)} className={field}>{ID_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select>
      </label>
      <label className="text-sm font-medium text-ink">Numéro<input name="idNumber" defaultValue={idNumber ?? ""} required className={field} /></label>
      <label className="text-sm font-medium text-ink">{needsVerso(type) ? "Recto" : "Page d'identité"}<input type="file" name="idRecto" accept="image/*,application/pdf" required className={field} /></label>
      {needsVerso(type) && <label className="text-sm font-medium text-ink">Verso<input type="file" name="idVerso" accept="image/*,application/pdf" required className={field} /></label>}
      <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
        <button disabled={pending || busy} className="rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{pending || busy ? "Envoi…" : "Enregistrer la pièce"}</button>
        {state?.ok && <span role="status" className="text-sm font-semibold text-emerald-800">Pièce enregistrée.</span>}
        {state && !state.ok && <span role="alert" className="text-sm font-semibold text-red-700">{state.error}</span>}
      </div>
    </form>
  );
}

/** Espèces reversées par le livreur. */
export function CashRemittanceForm({ action, owed }: { action: (prev: CashState, fd: FormData) => Promise<CashState>; owed: number }) {
  const [state, run, pending] = useActionState(action, null);
  return (
    <form action={run} className="flex flex-wrap items-end gap-2">
      <label className="text-sm font-medium text-ink">Espèces reçues du livreur (F)
        <input name="amount" type="number" min={1} step={1} defaultValue={owed > 0 ? owed : undefined} required className={`${field} w-40`} />
      </label>
      <label className="min-w-0 flex-1 text-sm font-medium text-ink">Note<input name="note" placeholder="Ex. remis au dépôt le 29/10" className={field} /></label>
      <button disabled={pending} className="rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{pending ? "…" : "Enregistrer"}</button>
      {state?.ok && <span role="status" className="w-full text-sm font-semibold text-emerald-800">{state.message}</span>}
      {state && !state.ok && <span role="alert" className="w-full text-sm font-semibold text-red-700">{state.error}</span>}
    </form>
  );
}
