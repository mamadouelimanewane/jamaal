import { reviews } from "@/data/reviews";
import { StarRating } from "@/components/StarRating";

export default function ReviewsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="font-serif-display text-3xl font-semibold text-navy">Avis clients JAMAAL</h1>
      <div className="mt-8 flex flex-col gap-4">
        {reviews.map((r, i) => (
          <div key={i} className="rounded-2xl border border-line bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-navy">{r.name}</p>
              <StarRating rating={r.rating} />
            </div>
            <p className="mt-2 text-sm text-navy/70">{r.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
