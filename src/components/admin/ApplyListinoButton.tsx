"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { applyListinoAction } from "@/lib/actions/listino";

/** Ajoute les formats manquants du listing Chogan après confirmation. */
export function ApplyListinoButton({ formats, products }: { formats: number; products: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div>
      <button
        type="button"
        disabled={pending || formats === 0}
        onClick={() => {
          if (!window.confirm(`Ajouter ${formats} format(s) (30 ml, 15 ml recharge, 50 ml…) sur ${products} produit(s) ?\nAucun prix ni stock existant n'est modifié ; la relance ne crée pas de doublon.`)) return;
          start(async () => {
            const r = await applyListinoAction();
            setMsg({ ok: r.ok, text: r.ok ? r.message ?? "Terminé." : r.error ?? "Échec." });
            router.refresh();
          });
        }}
        className="rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-light disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Ajout en cours…" : formats === 0 ? "Tout est à jour" : `Ajouter les ${formats} formats manquants`}
      </button>
      {msg && (
        <p role="status" className={`mt-2 text-sm ${msg.ok ? "text-emerald-700" : "text-rose-dark"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
