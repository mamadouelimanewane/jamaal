import Link from "next/link";
import { notFound } from "next/navigation";
import { getLiveOffers } from "@/lib/offers-public";
import { toOfferCard } from "@/lib/offer-card-data";
import { OfferCard } from "@/components/OfferCard";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [o] = await getLiveOffers({ slug });
  return { title: o ? `${o.title} | JAMAAL` : "Offre terminée | JAMAAL", description: o?.description.slice(0, 160) };
}

export default async function OfferPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [offer] = await getLiveOffers({ slug });
  if (!offer) notFound();
  return (
    <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
      <Link href="/offres" className="text-xs text-navy/60 hover:underline">← Toutes les offres</Link>
      <div className="mt-4">
        <OfferCard offer={toOfferCard(offer)} large />
      </div>
    </div>
  );
}
