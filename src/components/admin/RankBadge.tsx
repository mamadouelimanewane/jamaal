import { Award } from "lucide-react";
import type { ConsultantRank } from "@/lib/ranking";
import { RANK_LABELS } from "@/lib/ranking";

const styles: Record<Exclude<ConsultantRank, null>, string> = {
  GOLD: "bg-amber-100 text-amber-700",
  SILVER: "bg-slate-200 text-slate-700",
  BRONZE: "bg-orange-100 text-orange-800",
};

export function RankBadge({ rank }: { rank: ConsultantRank }) {
  if (!rank) {
    return <span className="text-xs text-navy/65">—</span>;
  }
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${styles[rank]}`}
    >
      <Award size={12} />
      {RANK_LABELS[rank]}
    </span>
  );
}
