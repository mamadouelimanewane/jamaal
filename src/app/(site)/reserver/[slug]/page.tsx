import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductBySlug } from "@/lib/db-products";
import { getReservationSettings } from "@/lib/reservation-store";
import { ReservationForm } from "@/components/ReservationForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Réserver un produit", robots: { index: false } };

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ format?: string; qte?: string }> };

/** Réservation d'un format en rupture : acompte maintenant, solde à l'arrivée du produit. */
export default async function ReservePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const [product, settings] = await Promise.all([getProductBySlug(slug), getReservationSettings()]);
  if (!product) notFound();
  const volumes = product.volumes ?? [{ label: "Format unique", price: product.regularPrice ?? 0 }];
  const out = volumes.filter((v) => (product.availability?.[v.label] ?? Infinity) <= 0);
  const chosen = out.find((v) => v.label === sp.format) ?? out[0];
  const qty = Math.min(20, Math.max(1, Math.round(Number(sp.qte)) || 1));

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
      <Link href={`/produits/${product.slug}`} className="text-sm font-semibold text-rose-dark hover:underline">← {product.name}</Link>
      <h1 className="mt-3 font-serif-display text-3xl font-semibold text-navy">Réserver</h1>
      {!settings.enabled ? (
        <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">La réservation n&apos;est pas proposée pour le moment. Contactez-nous sur WhatsApp pour ce produit.</p>
      ) : !chosen ? (
        <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Bonne nouvelle : ce produit est disponible. <Link href={`/produits/${product.slug}`} className="font-semibold underline">Ajoutez-le directement au panier.</Link>
        </p>
      ) : (
        <ReservationForm
          product={{ id: product.id, slug: product.slug, name: product.name, photo: product.photo ?? null }}
          formats={out}
          initialFormat={chosen.label}
          initialQty={qty}
          settings={settings}
        />
      )}
    </div>
  );
}
