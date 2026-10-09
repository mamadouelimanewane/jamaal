"use client";

import { useActionState, useState } from "react";
import { signProtocolAction, type ProtocolActionResult } from "@/lib/actions/protocol";
import { SignaturePad } from "@/components/SignaturePad";

/** Membre en place : « Lu et approuvé » + signature, version en vigueur. */
export function SignProtocolForm({ version }: { version: number }) {
  const [state, action, pending] = useActionState(signProtocolAction, { ok: false } as ProtocolActionResult);
  const [signature, setSignature] = useState<string | null>(null);
  if (state.ok)
    return (
      <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        {state.message}{" "}
        <a href={`/api/protocole/${state.signatureId}`} target="_blank" rel="noopener noreferrer" className="font-semibold underline">Télécharger le PDF</a>
      </p>
    );
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="version" value={version} />
      <input type="hidden" name="signature" value={signature ?? ""} />
      <label className="flex items-start gap-3 text-sm font-medium text-navy">
        <input type="checkbox" name="accept" required className="mt-1 h-4 w-4 accent-[#1d2f4f]" />
        Lu et approuvé : j&apos;accepte le protocole de partenariat JAMAAL (version {version}).
      </label>
      <SignaturePad onChange={setSignature} />
      {state.error && <p role="alert" className="text-sm text-rose-dark">{state.error}</p>}
      <button disabled={pending || !signature} className="rounded-full bg-navy px-6 py-2.5 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-50">{pending ? "Signature…" : "Signer le protocole"}</button>
    </form>
  );
}
