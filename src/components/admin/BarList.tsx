export function BarList({
  items,
  formatValue,
  color = "navy",
}: {
  items: { label: string; value: number }[];
  formatValue?: (v: number) => string;
  color?: "navy" | "rose" | "emerald";
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  const barColor = color === "rose" ? "bg-rose" : color === "emerald" ? "bg-emerald-400" : "bg-navy";

  if (items.length === 0) {
    return <p className="text-sm text-navy/70">Pas encore assez de données.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-medium text-navy">{item.label}</span>
            <span className="text-navy/75">{formatValue ? formatValue(item.value) : item.value}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-cream">
            <div
              className={`h-full rounded-full ${barColor}`}
              style={{ width: `${Math.max(4, (item.value / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
