"use client";

import { useActionState, useState } from "react";
import { saveProtocolAction, type ProtocolActionResult } from "@/lib/actions/protocol";
import { fillProtocol } from "@/lib/protocol";
import { ProtocolText } from "@/components/ProtocolText";

/** Admin : texte du protocole avec aperçu. */
export function ProtocolEditor({ text }: { text: string }) {
  const [state, action, pending] = useActionState(saveProtocolAction, { ok: false } as ProtocolActionResult);
  const [value, setValue] = useState(text);
  const [preview, setPreview] = useState(false);
  return (
    <form action={action} className="space-y-3">
      <div className="flex gap-2 text-sm font-semibold">
        <button type="button" onClick={() => setPreview(false)} aria-pressed={!preview} className={`rounded-full px-3 py-1.5 ${!preview ? "bg-navy text-white" : "border border-line text-navy"}`}>Texte</button>
        <button type="button" onClick={() => setPreview(true)} aria-pressed={preview} className={`rounded-full px-3 py-1.5 ${preview ? "bg-navy text-white" : "border border-line text-navy"}`}>Aperçu</button>
      </div>
      <textarea name="text" value={value} onChange={(e) => setValue(e.target.value)} rows={28} spellCheck className={`${preview ? "hidden" : "block"} w-full rounded-xl border border-line bg-white p-4 font-mono text-[13px] leading-relaxed outline-none focus:border-navy`} />
      {preview && (
        <div className="max-h-[70vh] overflow-y-auto rounded-xl border border-line bg-white p-5">
          <ProtocolText text={fillProtocol(value, { nom: "Awa Diop", piece: "Carte nationale d'identité n° 1 234 1990 01234", adresse: "Sacré-Cœur 3, villa 12, Dakar", telephone: "+221 77 123 45 67", code_parrain: "aminata" })} />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className="rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60">{pending ? "Enregistrement…" : "Enregistrer le protocole"}</button>
        {state.message && <span role="status" className="text-sm text-emerald-800">{state.message}</span>}
        {state.error && <span role="alert" className="text-sm text-rose-dark">{state.error}</span>}
      </div>
    </form>
  );
}
