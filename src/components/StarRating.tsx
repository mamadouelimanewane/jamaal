import { Star } from "lucide-react";

export function StarRating({ rating, count }: { rating: number; count?: number }) {
  return (
    <div className="flex items-center gap-1 text-xs text-navy/60">
      <div className="flex">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            size={13}
            className={i < Math.round(rating) ? "fill-rose text-rose" : "fill-transparent text-line"}
          />
        ))}
      </div>
      {count !== undefined && <span>({count})</span>}
    </div>
  );
}
