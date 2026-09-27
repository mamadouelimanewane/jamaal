export function ProgressBar({ value, color = "navy" }: { value: number; color?: "navy" | "amber" | "emerald" }) {
  const pct = Math.min(100, Math.max(0, value));
  const barColor = color === "amber" ? "bg-amber-500" : color === "emerald" ? "bg-emerald-500" : "bg-navy";
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-cream">
      <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}
