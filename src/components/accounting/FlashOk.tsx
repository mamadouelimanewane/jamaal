"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CircleCheck, X } from "lucide-react";

/** Confirmation d'une action (?ok=…). */
export function FlashOk() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const msg = params.get("ok");
  if (!msg) return null;
  const close = () => {
    const next = new URLSearchParams(params.toString());
    next.delete("ok");
    router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false });
  };
  return (
    <div role="status" className="mt-4 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 print:hidden">
      <CircleCheck size={18} className="mt-0.5 shrink-0" />
      <p className="flex-1">{msg}</p>
      <button type="button" onClick={close} aria-label="Fermer" className="rounded p-0.5 hover:bg-emerald-100"><X size={16} /></button>
    </div>
  );
}
