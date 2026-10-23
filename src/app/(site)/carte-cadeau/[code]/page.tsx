import Link from "next/link";
import { notFound } from "next/navigation";
import { Gift } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { occasionPhrase } from "@/lib/gift/gift";

export const dynamic = "force-dynamic";
export const metadata = { title: "Votre carte cadeau JAMAAL", robots: { index: false } };

/** Carte reçue : montant, solde, message (et vocal) de l'expéditeur, puis la boutique. */
export default async function CarteRecuePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const clean = decodeURIComponent(code).toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 20);
  const card = await prisma.giftCard.findUnique({ where: { code: clean }, select: { code: true, amount: true, balance: true, status: true, buyerName: true, recipientName: true, occasion: true, message: true, voiceUrl: true, expiresAt: true } });
  if (!card || card.status === "EN_ATTENTE" || card.status === "ANNULEE") notFound();
  const usable = card.status === "ACTIVE" && card.balance > 0 && (!card.expiresAt || card.expiresAt > new Date());
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <div className="rounded-3xl bg-gradient-to-br from-navy to-[#3a2a3f] p-7 text-white shadow-xl">
        <p className="flex items-center gap-2 text-xs uppercase tracking-widest text-white/70"><Gift size={14} /> Carte cadeau JAMAAL</p>
        <p className="mt-6 text-sm text-white/80">{card.recipientName.split(" ")[0]}, {card.buyerName} vous offre{occasionPhrase(card.occasion)}</p>
        <p className="mt-2 font-serif-display text-5xl">{card.amount.toLocaleString("fr-FR")} <span className="text-xl">FCFA</span></p>
        {card.message && <p className="mt-5 rounded-2xl bg-white/10 px-4 py-3 text-sm italic">« {card.message} »</p>}
        {card.voiceUrl && <audio src={card.voiceUrl} controls className="mt-4 w-full" />}
        <p className="mt-6 text-xs uppercase tracking-widest text-white/60">Votre code</p>
        <p className="font-mono text-2xl tracking-widest">{card.code}</p>
        <p className="mt-2 text-sm text-white/80">{usable ? `Solde : ${card.balance.toLocaleString("fr-FR")} FCFA${card.expiresAt ? `, valable jusqu'au ${card.expiresAt.toLocaleDateString("fr-FR")}` : ""}` : "Cette carte a été entièrement utilisée."}</p>
      </div>
      {usable && (
        <div className="mt-6 space-y-3 text-center">
          <p className="text-sm text-navy/75">Choisissez vos produits, puis saisissez ce code au panier (champ « Code promo »). La livraison est comprise.</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link href="/collections" className="rounded-full bg-navy px-6 py-3 font-semibold text-white hover:bg-navy-light">Choisir mes cadeaux</Link>
            <Link href="/parfum-adn" className="rounded-full border border-line px-6 py-3 font-semibold text-navy hover:bg-cream">Trouver mon parfum</Link>
          </div>
        </div>
      )}
    </div>
  );
}
