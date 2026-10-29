"use client";

import { useState } from "react";
import Link from "next/link";
import { AUDIENCES, type Audience } from "@/lib/coupon-audience";

type Initial = {
  audience?: string; targetName?: string | null; targetPhone?: string | null; targetConsultantId?: string | null; note?: string | null;
  type?: string; value?: number; usageLimit?: number | null; expiresAt?: string | null; active?: boolean; code?: string;
};

const field = "mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm";

/** Formulaire d'un code promo : pour qui (tous les clients, un client, un vendeur, tous les vendeurs) et avantage. Le code est créé par le système. */
export function CouponForm({ action, consultants, initial = {}, submitLabel }: { action: (fd: FormData) => void | Promise<void>; consultants: { id: string; name: string; city: string }[]; initial?: Initial; submitLabel: string }) {
  const [audience, setAudience] = useState<Audience>((AUDIENCES.find((a) => a.id === initial.audience)?.id ?? "TOUS_CLIENTS") as Audience);
  return (
    <form action={action} className="mt-6 grid gap-4 rounded-2xl border border-line bg-white p-5 sm:grid-cols-2">
      <fieldset className="sm:col-span-2">
        <legend className="text-xs font-semibold text-navy/85">Pour qui ?</legend>
        <input type="hidden" name="audience" value={audience} />
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {AUDIENCES.map((a) => (
            <button key={a.id} type="button" aria-pressed={audience === a.id} onClick={() => setAudience(a.id)} className={`rounded-xl px-3 py-2.5 text-left text-sm ${audience === a.id ? "border-2 border-navy bg-cream/60" : "border border-line hover:bg-cream/40"}`}>
              <span className="block font-semibold text-navy">{a.label}</span>
              <span className="block text-xs text-navy/65">{a.help}</span>
            </button>
          ))}
        </div>
      </fieldset>
      {audience === "CLIENT" && (
        <>
          <label className="text-xs font-semibold text-navy/85">Nom du client<input name="targetName" defaultValue={initial.targetName ?? ""} maxLength={80} placeholder="Awa Diop" className={field} /></label>
          <label className="text-xs font-semibold text-navy/85">Téléphone WhatsApp du client<input name="targetPhone" defaultValue={initial.targetPhone ?? ""} required inputMode="tel" placeholder="77 123 45 67" className={field} /></label>
        </>
      )}
      {audience === "VENDEUR" && (
        <label className="text-xs font-semibold text-navy/85 sm:col-span-2">Vendeur
          <select name="targetConsultantId" defaultValue={initial.targetConsultantId ?? ""} required className={field}>
            <option value="">Choisir un vendeur…</option>
            {consultants.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.city}</option>)}
          </select>
        </label>
      )}
      {initial.code && <p className="text-sm text-navy sm:col-span-2">Code : <strong className="tracking-wider">{initial.code}</strong> <span className="text-navy/60">(créé par le système)</span></p>}
      <label className="text-xs font-semibold text-navy/85">Type d&apos;avantage
        <select name="type" defaultValue={initial.type ?? "POURCENTAGE"} className={field}>
          <option value="POURCENTAGE">Pourcentage</option>
          <option value="MONTANT_FIXE">Montant fixe (FCFA)</option>
        </select>
      </label>
      <label className="text-xs font-semibold text-navy/85">Valeur<input name="value" type="number" required min={1} max={10000000} defaultValue={initial.value ?? ""} className={field} /></label>
      <label className="text-xs font-semibold text-navy/85">Nombre d&apos;utilisations
        <input key={audience} name="usageLimit" type="number" min={1} defaultValue={initial.usageLimit ?? (audience === "CLIENT" ? 1 : "")} placeholder="Illimité" className={field} />
      </label>
      <label className="text-xs font-semibold text-navy/85">Date d&apos;expiration (facultatif)<input name="expiresAt" type="datetime-local" defaultValue={initial.expiresAt ?? ""} className={field} /></label>
      <label className="text-xs font-semibold text-navy/85 sm:col-span-2">Note interne (facultatif)<input name="note" maxLength={160} defaultValue={initial.note ?? ""} placeholder="Ex. geste commercial après retard de livraison" className={field} /></label>
      <label className="flex items-center gap-2 text-sm text-navy/85 sm:col-span-2"><input type="checkbox" name="active" defaultChecked={initial.active ?? true} /> Code actif</label>
      <div className="flex gap-2 sm:col-span-2">
        <button className="rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-white">{submitLabel}</button>
        <Link href="/admin/coupons" className="rounded-full border border-line px-5 py-2.5 text-sm">Annuler</Link>
      </div>
    </form>
  );
}
