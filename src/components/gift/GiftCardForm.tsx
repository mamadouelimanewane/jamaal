"use client";

import { useState, useTransition } from "react";
import { Gift, Loader2 } from "lucide-react";
import { buyGiftCard } from "@/lib/actions/gifts";
import { GIFT_AMOUNTS, GIFT_MAX, GIFT_MIN, OCCASIONS, occasionPhrase } from "@/lib/gift/gift";
import { VoiceRecorder } from "./VoiceRecorder";

const chip = (on: boolean) => `rounded-full border px-4 py-2 text-sm transition ${on ? "border-navy bg-navy text-white" : "border-line bg-white text-navy hover:border-navy/40"}`;
const input = "mt-1 w-full rounded-full border border-line bg-white px-4 py-2.5 text-sm";

type Props = { methods: { id: string; label: string }[]; refSlug: string | null; cancelled: boolean };

/** Achat d'une carte cadeau, envoyée sur WhatsApp à la personne qui la reçoit (au Sénégal ou ailleurs). */
export function GiftCardForm({ methods, refSlug, cancelled }: Props) {
  const [amount, setAmount] = useState(30_000);
  const [custom, setCustom] = useState("");
  const [occasion, setOccasion] = useState("tabaski");
  const [f, setF] = useState({ recipientName: "", recipientPhone: "", buyerName: "", buyerPhone: "", buyerEmail: "", message: "" });
  const [voiceUrl, setVoiceUrl] = useState<string | null>(null);
  const [method, setMethod] = useState(methods[0]?.id ?? "");
  const [error, setError] = useState<string | null>(cancelled ? "Paiement annulé : vous pouvez réessayer." : null);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const finalAmount = custom ? Number(custom.replace(/\D/g, "")) : amount;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await buyGiftCard({ ...f, amount: finalAmount, occasion, voiceUrl, method, ref: refSlug });
      if (r.ok && r.redirectUrl) window.location.href = r.redirectUrl;
      else setError(r.error ?? "Paiement impossible, réessayez.");
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <section className="rounded-3xl border border-line bg-white p-5 sm:p-7">
          <h2 className="font-serif-display text-xl text-navy">1. Le montant</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {GIFT_AMOUNTS.map((a) => <button key={a} type="button" aria-pressed={!custom && amount === a} onClick={() => { setAmount(a); setCustom(""); }} className={chip(!custom && amount === a)}>{a.toLocaleString("fr-FR")} F</button>)}
          </div>
          <label className="mt-3 block text-sm text-navy">Autre montant (FCFA)
            <input value={custom} onChange={(e) => setCustom(e.target.value)} inputMode="numeric" placeholder={`${GIFT_MIN.toLocaleString("fr-FR")} à ${GIFT_MAX.toLocaleString("fr-FR")}`} className={`${input} max-w-xs`} />
          </label>
          <p className="mt-4 text-sm font-semibold text-navy">L&apos;occasion</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {OCCASIONS.map((o) => <button key={o.id} type="button" aria-pressed={occasion === o.id} onClick={() => setOccasion(o.id)} className={chip(occasion === o.id)}>{o.label}</button>)}
          </div>
        </section>

        <section className="rounded-3xl border border-line bg-white p-5 sm:p-7">
          <h2 className="font-serif-display text-xl text-navy">2. Pour qui ?</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-navy">Prénom et nom<input required value={f.recipientName} onChange={set("recipientName")} maxLength={80} className={input} /></label>
            <label className="text-sm text-navy">Son numéro WhatsApp<input required value={f.recipientPhone} onChange={set("recipientPhone")} inputMode="tel" placeholder="77 123 45 67" maxLength={20} className={input} /></label>
          </div>
          <label className="mt-3 block text-sm text-navy">Votre message
            <textarea value={f.message} onChange={set("message")} maxLength={300} rows={3} placeholder="Bonne fête, je pense fort à toi…" className="mt-1 w-full rounded-2xl border border-line px-4 py-2.5 text-sm" />
          </label>
          <div className="mt-3"><VoiceRecorder value={voiceUrl} onChange={setVoiceUrl} /></div>
        </section>

        <section className="rounded-3xl border border-line bg-white p-5 sm:p-7">
          <h2 className="font-serif-display text-xl text-navy">3. De la part de</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="text-sm text-navy">Votre nom<input required value={f.buyerName} onChange={set("buyerName")} maxLength={80} autoComplete="name" className={input} /></label>
            <label className="text-sm text-navy">Votre WhatsApp<input value={f.buyerPhone} onChange={set("buyerPhone")} inputMode="tel" placeholder="+33 6…" maxLength={20} autoComplete="tel" className={input} /></label>
            <label className="text-sm text-navy">E-mail <span className="text-navy/50">(reçu)</span><input type="email" value={f.buyerEmail} onChange={set("buyerEmail")} maxLength={120} autoComplete="email" className={input} /></label>
          </div>
        </section>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-3xl bg-gradient-to-br from-navy to-[#3a2a3f] p-6 text-white shadow-lg">
          <p className="flex items-center gap-2 text-xs uppercase tracking-widest text-white/70"><Gift size={14} /> Carte cadeau JAMAAL</p>
          <p className="mt-6 font-serif-display text-4xl">{Number.isFinite(finalAmount) && finalAmount > 0 ? finalAmount.toLocaleString("fr-FR") : "—"} <span className="text-lg">FCFA</span></p>
          <p className="mt-4 text-sm text-white/80">Pour {f.recipientName || "…"}{occasionPhrase(occasion)}</p>
          <p className="text-sm text-white/80">De {f.buyerName || "…"}</p>
          <p className="mt-4 font-mono text-sm tracking-widest text-white/60">JML-••••-••••</p>
        </div>
        <div className="rounded-3xl border border-line bg-white p-5">
          <p className="text-sm font-semibold text-navy">Paiement</p>
          {methods.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {methods.map((m) => <button key={m.id} type="button" aria-pressed={method === m.id} onClick={() => setMethod(m.id)} className={chip(method === m.id)}>{m.label}</button>)}
            </div>
          ) : (
            <p className="mt-2 text-sm text-rose-dark">Le paiement en ligne n&apos;est pas ouvert pour le moment : écrivez-nous sur WhatsApp.</p>
          )}
          {error && <p role="alert" className="mt-3 text-sm text-rose-dark">{error}</p>}
          <button disabled={pending || !methods.length} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-rose-dark px-6 py-3.5 font-semibold text-white hover:opacity-90 disabled:opacity-50">
            {pending ? <Loader2 size={18} className="animate-spin" /> : <Gift size={18} />} Payer et envoyer la carte
          </button>
          <p className="mt-2 text-xs text-navy/60">Envoyée sur WhatsApp dès le paiement reçu. Valable 1 an, utilisable en une ou plusieurs fois, livraison comprise.</p>
        </div>
      </aside>
    </form>
  );
}
