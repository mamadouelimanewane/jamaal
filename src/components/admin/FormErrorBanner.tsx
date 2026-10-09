"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CircleAlert, X } from "lucide-react";

/** Message d'erreur d'un formulaire (?erreur=…), renvoyé par une action serveur. */
export function FormErrorBanner() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const msg = params.get("erreur");
  if (!msg) return null;
  const close = () => {
    const next = new URLSearchParams(params.toString());
    next.delete("erreur");
    router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false });
  };
  return (
    <div role="alert" className="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      <CircleAlert size={18} className="mt-0.5 shrink-0" />
      <p className="flex-1"><strong>Non enregistré :</strong> {msg}</p>
      <button type="button" onClick={close} aria-label="Fermer" className="rounded p-0.5 hover:bg-red-100"><X size={16} /></button>
    </div>
  );
}
