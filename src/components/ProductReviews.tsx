import { prisma } from "@/lib/prisma";
import { StarRating } from "@/components/StarRating";

/** Avis publiés d'un produit (validés par JAMAAL), avec la photo du client s'il en a ajouté une. */
export async function ProductReviews({ productId }: { productId: string }) {
  const reviews = await prisma.review.findMany({ where: { productId, approved: true }, orderBy: [{ photo: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }], take: 6 }).catch(() => []);
  if (!reviews.length) return null;
  return (
    <section className="mt-16 border-t border-[#eadfda] pt-10">
      <p className="luxury-eyebrow">Ils l&apos;ont adopté</p>
      <h2 className="mt-2 font-serif-display text-2xl text-navy sm:text-3xl">Avis clients</h2>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reviews.map((r) => (
          <article key={r.id} className="overflow-hidden rounded-2xl border border-line bg-white">
            {r.photo && (
              // eslint-disable-next-line @next/next/no-img-element -- photo envoyée par le client
              <img src={r.photo} alt={`Photo de ${r.authorName}`} loading="lazy" className="aspect-[4/3] w-full object-cover" />
            )}
            <div className="p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-navy">{r.authorName}</p>
                <StarRating rating={r.rating} />
              </div>
              {r.comment && r.comment !== "—" && <p className="mt-2 text-sm text-navy/75">{r.comment}</p>}
              {r.orderId && <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-ia">Achat vérifié</p>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
