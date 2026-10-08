import { Trophy } from "lucide-react";
import { formatPrice } from "@/lib/currency";
import type { LeaderboardEntry } from "@/lib/ranking";
import { RankBadge } from "./RankBadge";

const medalColors = ["text-amber-500", "text-slate-400", "text-orange-600"];

export function MonthlyLeaderboard({ entries }: { entries: LeaderboardEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-navy/70">Aucune vente enregistrée ce mois-ci pour le moment.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {entries.map((e, i) => (
        <li
          key={e.consultantId}
          className="flex items-center gap-3 rounded-xl border border-line bg-white p-3"
        >
          <Trophy size={18} className={medalColors[i] ?? "text-navy/55"} />
          <div className="flex-1">
            <p className="text-sm font-medium text-navy">{e.name}</p>
            <p className="text-xs text-navy/70">{e.city}</p>
          </div>
          <span className="text-sm font-semibold text-navy">{formatPrice(e.monthlyRevenue)}</span>
          <RankBadge rank={e.rank} />
        </li>
      ))}
    </ul>
  );
}
