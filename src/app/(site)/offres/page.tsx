import Link from "next/link";
import { getLiveOffers } from "@/lib/offers-public";
import { toOfferCard } from "@/lib/offer-card-data";
import { OfferCard } from "@/components/OfferCard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Offres et coffrets de fêtes | JAMAAL", description: "Coffrets à prix spécial pour la Tabaski, la Korité, la Saint-Valentin et toutes les fêtes." };

export default async function OffersPage() {
  const offers = await getLiveOffers();
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ia">Offres du moment</p>
      <h1 className="mt-3 font-serif-display text-3xl font-semibold text-navy sm:text-4xl">Coffrets de fêtes</h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-navy/70">Des duos et trios pensés pour offrir ou se faire plaisir, à prix spécial pendant une durée limitée.</p>
      {offers.length ? (
        <div className="mt-9 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{offers.map((o) => <OfferCard key={o.id} offer={toOfferCard(o)} />)}</div>
      ) : (
        <div className="mt-9 rounded-2xl border border-line bg-white p-7 text-sm text-navy/70">
          Pas d&apos;offre en ce moment. Découvrez les <Link href="/coffrets-decouverte" className="font-semibold text-ia-dark underline">coffrets découverte</Link> ou toute la <Link href="/collections" className="font-semibold text-ia-dark underline">collection</Link>.
        </div>
      )}
    </div>
  );
}
