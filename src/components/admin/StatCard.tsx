import Link from "next/link";
import type { LucideIcon } from "lucide-react";

const colorMap: Record<string, string> = {
  navy: "bg-navy/10 text-navy",
  rose: "bg-rose/20 text-rose-dark",
  emerald: "bg-emerald-100 text-emerald-700",
  amber: "bg-amber-100 text-amber-700",
  blue: "bg-blue-100 text-blue-700",
  purple: "bg-purple-100 text-purple-700",
  red: "bg-red-100 text-red-700",
};

export function StatCard({
  label,
  value,
  icon: Icon,
  color = "navy",
  href,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color?: keyof typeof colorMap;
  href?: string;
}) {
  const content = (
    <div className="flex items-center gap-4 rounded-2xl border border-line bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${colorMap[color]}`}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-2xl font-semibold text-navy">{value}</p>
        <p className="mt-0.5 text-xs text-navy/75">{label}</p>
      </div>
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}
