import Link from "next/link";
import { PRESETS, type PeriodChoice } from "@/lib/accounting/period";

/** Choix de la période (liens rapides + dates libres). Conserve les autres paramètres de la page. */
export function PeriodPicker({ path, period, keep = {}, presets }: { path: string; period: PeriodChoice; keep?: Record<string, string | undefined>; presets?: string[] }) {
  const extra = Object.entries(keep).filter((e): e is [string, string] => !!e[1]);
  const link = (p: string) => {
    const q = new URLSearchParams(extra);
    q.set("p", p);
    return `${path}?${q}`;
  };
  return (
    <div className="print:hidden mt-4 flex flex-col gap-3 rounded-2xl border border-line bg-white p-3 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.filter((p) => !presets || presets.includes(p.id)).map((p) => (
          <Link key={p.id} href={link(p.id)} className={`rounded-full px-3 py-1 text-xs font-semibold ${period.preset === p.id ? "bg-rose-dark text-white" : "bg-cream text-navy hover:bg-line"}`}>
            {p.label}
          </Link>
        ))}
      </div>
      <form action={path} className="flex flex-wrap items-center gap-2 text-xs sm:ml-auto">
        {extra.map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        <label className="flex items-center gap-1">Du <input type="date" name="du" defaultValue={period.fromStr} className="rounded-lg border border-line px-2 py-1" /></label>
        <label className="flex items-center gap-1">au <input type="date" name="au" defaultValue={period.toStr} className="rounded-lg border border-line px-2 py-1" /></label>
        <button className="rounded-full bg-navy px-3 py-1.5 font-semibold text-white">Voir</button>
      </form>
    </div>
  );
}
