import { monthLabel } from "@/lib/accounting/reports";

type Point = { month: string; revenue: number; charges: number; result: number };

/** Histogramme mensuel : chiffre d'affaires, charges, résultat (SVG, sans JavaScript). */
export function MonthlyChart({ data }: { data: Point[] }) {
  const W = 720, H = 240, P = { l: 52, r: 8, t: 12, b: 34 };
  const max = Math.max(1, ...data.flatMap((d) => [d.revenue, d.charges, d.result]));
  const min = Math.min(0, ...data.map((d) => d.result));
  const span = max - min || 1;
  const y = (v: number) => P.t + ((max - v) / span) * (H - P.t - P.b);
  const slot = (W - P.l - P.r) / Math.max(1, data.length);
  const bw = Math.max(4, slot * 0.32);
  const ticks = [max, max / 2, 0, ...(min < 0 ? [min] : [])];
  const short = (v: number) => (Math.abs(v) >= 1_000_000 ? `${(v / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M` : Math.abs(v) >= 1000 ? `${Math.round(v / 1000)} k` : `${Math.round(v)}`);
  const line = data.map((d, i) => `${P.l + slot * i + slot / 2},${y(d.result)}`).join(" ");
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Chiffre d'affaires, charges et résultat par mois">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke={t === 0 ? "#16233a" : "#e8e1d8"} strokeWidth={t === 0 ? 1 : 0.8} />
            <text x={P.l - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#16233a99">{short(t)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = P.l + slot * i + slot / 2;
          return (
            <g key={d.month}>
              <rect x={x - bw - 1} y={y(Math.max(0, d.revenue))} width={bw} height={Math.max(0, y(0) - y(Math.max(0, d.revenue)))} rx="2" fill="#16233a"><title>{`CA ${d.revenue.toLocaleString("fr-FR")} F`}</title></rect>
              <rect x={x + 1} y={y(Math.max(0, d.charges))} width={bw} height={Math.max(0, y(0) - y(Math.max(0, d.charges)))} rx="2" fill="#c9997a"><title>{`Charges ${d.charges.toLocaleString("fr-FR")} F`}</title></rect>
              <text x={x} y={H - 14} textAnchor="middle" fontSize="11" fill="#16233a">{monthLabel(d.month, "short").replace(/\s\d{4}$/, "").replace(".", "")}</text>
            </g>
          );
        })}
        <polyline points={line} fill="none" stroke="#059669" strokeWidth="2" />
        {data.map((d, i) => (
          <circle key={d.month} cx={P.l + slot * i + slot / 2} cy={y(d.result)} r="3.5" fill={d.result < 0 ? "#b91c1c" : "#059669"}>
            <title>{`Résultat ${d.result.toLocaleString("fr-FR")} F`}</title>
          </circle>
        ))}
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-4 text-xs text-navy/80">
        <span className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-navy" />Chiffre d&apos;affaires</span>
        <span className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-[#c9997a]" />Charges</span>
        <span className="flex items-center gap-1.5"><i className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-600" />Résultat</span>
      </figcaption>
    </figure>
  );
}
