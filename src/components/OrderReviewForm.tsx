"use client";

import { useState, useTransition } from "react";
import { Camera, Loader2, Star } from "lucide-react";
import { submitOrderReviews } from "@/lib/actions/growth";
import { compressImage } from "@/lib/image-compress";

/** Avis après livraison : une note (et un mot) par produit, une photo facultative. */
export function OrderReviewForm({ orderId, token, firstName, products }: { orderId: string; token: string; firstName: string; products: { id: string; name: string }[] }) {
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [state, setState] = useState<{ ok: boolean; error?: string } | null>(null);
  const [pending, start] = useTransition();

  if (state?.ok)
    return (
      <div className="rounded-2xl border border-ia/30 bg-ia-light/50 p-6 text-center">
        <p className="text-3xl">🌸</p>
        <p className="mt-2 font-semibold text-navy">Merci {firstName} !</p>
        <p className="mt-1 text-sm text-navy/75">Votre avis a bien été envoyé. Il sera publié après une rapide vérification.</p>
      </div>
    );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.delete("photo");
        start(async () => {
          if (photo) fd.set("photo", await compressImage(photo));
          setState(await submitOrderReviews({ ok: false }, fd));
        });
      }}
      className="space-y-5"
    >
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="t" value={token} />
      {products.map((p) => (
        <fieldset key={p.id} className="rounded-2xl border border-line bg-white p-4">
          <legend className="px-1 text-sm font-semibold text-navy">{p.name}</legend>
          <input type="hidden" name={`rating-${p.id}`} value={ratings[p.id] ?? 0} />
          <div className="flex gap-1" role="radiogroup" aria-label={`Note pour ${p.name}`}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={(ratings[p.id] ?? 0) === n} aria-label={`${n} étoile${n > 1 ? "s" : ""}`} onClick={() => setRatings((r) => ({ ...r, [p.id]: n }))} className="p-1">
                <Star size={30} className={(ratings[p.id] ?? 0) >= n ? "fill-amber-400 text-amber-400" : "text-navy/25"} />
              </button>
            ))}
          </div>
          <textarea name={`comment-${p.id}`} rows={2} maxLength={2000} placeholder="Votre avis en quelques mots (tenue, sillage, emballage…)" className="mt-2 w-full rounded-lg border border-line px-3 py-2 text-sm" />
        </fieldset>
      ))}
      <label className="block text-sm font-medium text-navy">
        Votre prénom (affiché avec l&apos;avis)
        <input name="authorName" defaultValue={firstName} maxLength={80} className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm" />
      </label>
      <div>
        <input
          id="review-photo"
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            setPhoto(f);
            setPreview(f ? URL.createObjectURL(f) : null);
          }}
        />
        <label htmlFor="review-photo" className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ia/40 bg-ia-light/40 px-4 py-4 text-sm font-semibold text-ia-dark hover:bg-ia-light">
          <Camera size={18} /> {photo ? "Changer la photo" : "Ajouter une photo (facultatif)"}
        </label>
        {/* eslint-disable-next-line @next/next/no-img-element -- aperçu local */}
        {preview && <img src={preview} alt="Aperçu de votre photo" className="mx-auto mt-3 max-h-48 rounded-xl" />}
      </div>
      {state?.error && <p role="alert" className="text-sm text-rose-dark">{state.error}</p>}
      <button type="submit" disabled={pending || !Object.values(ratings).some((r) => r > 0)} className="flex w-full items-center justify-center gap-2 rounded-full bg-ia py-3 text-sm font-semibold text-white hover:bg-ia-dark disabled:opacity-50">
        {pending && <Loader2 size={16} className="animate-spin" />} Envoyer mon avis
      </button>
    </form>
  );
}
