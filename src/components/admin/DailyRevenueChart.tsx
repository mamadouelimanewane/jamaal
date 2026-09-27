export function DailyRevenueChart({ data }: { data: { date: string; total: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.total));
  const width = 700;
  const height = 200;
  const barWidth = width / data.length;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img">
      {data.map((d, i) => {
        const barHeight = (d.total / max) * (height - 30);
        const x = i * barWidth;
        const y = height - barHeight - 20;
        return (
          <g key={d.date}>
            <rect
              x={x + barWidth * 0.15}
              y={y}
              width={barWidth * 0.7}
              height={barHeight}
              rx={3}
              className="fill-navy"
              opacity={0.85}
            />
            {i % Math.ceil(data.length / 10 || 1) === 0 && (
              <text
                x={x + barWidth / 2}
                y={height - 4}
                textAnchor="middle"
                fontSize="9"
                className="fill-current text-navy/50"
              >
                {d.date.slice(5)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
