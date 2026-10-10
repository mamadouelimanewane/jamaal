import type { ReactNode } from "react";
import { fcfa } from "@/lib/accounting/format";

export function Card({ title, children, action, className = "" }: { title?: ReactNode; children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-line bg-white p-4 sm:p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="font-serif-display text-lg font-semibold text-navy">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Kpi({ label, value, hint, tone = "navy", href }: { label: string; value: number | string; hint?: ReactNode; tone?: "navy" | "green" | "red" | "amber"; href?: string }) {
  const color = tone === "green" ? "text-emerald-700" : tone === "red" ? "text-red-700" : tone === "amber" ? "text-amber-700" : "text-navy";
  const body = (
    <div className="h-full rounded-2xl border border-line bg-white p-4 transition hover:shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-navy/70">{label}</p>
      <p className={`mt-1 text-xl font-semibold sm:text-2xl ${color}`}>{typeof value === "number" ? fcfa(value) : value}</p>
      {hint && <p className="mt-1 text-xs text-navy/70">{hint}</p>}
    </div>
  );
  return href ? <a href={href} className="block h-full">{body}</a> : body;
}

/** Montant aligné à droite ; négatif en rouge. */
export function Amount({ value, strong = false, blankZero = false }: { value: number; strong?: boolean; blankZero?: boolean }) {
  const v = Math.round(value) || 0; // pas de « -0 »
  if (blankZero && !v) return <span />;
  return <span className={`whitespace-nowrap tabular-nums ${v < 0 ? "text-red-700" : ""} ${strong ? "font-semibold" : ""}`}>{v.toLocaleString("fr-FR")}</span>;
}

export const th = "px-3 py-2.5 text-left text-xs font-semibold uppercase text-navy/70";
export const thr = "px-3 py-2.5 text-right text-xs font-semibold uppercase text-navy/70";
export const td = "px-3 py-2 text-navy";
export const tdr = "px-3 py-2 text-right text-navy";
export const field = "w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-navy";
export const btn = "rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light disabled:opacity-60";
export const btnLight = "rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-navy hover:bg-cream";

export function ExportLinks({ type, query }: { type: string; query: string }) {
  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      <a href={`/api/export/comptabilite?type=${type}&${query}`} className={btnLight}>Excel ↓</a>
    </div>
  );
}
