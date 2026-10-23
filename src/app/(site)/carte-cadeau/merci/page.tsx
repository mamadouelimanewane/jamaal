import Link from "next/link";
import { CheckCircle2, Clock } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { settlePendingPayment } from "@/lib/payment/settle";
import { GIFT_PREFIX } from "@/lib/gift/gift";

export const dynamic = "force-dynamic";
export const metadata = { title: "Merci pour votre cadeau", robots: { index: false } };

/** Retour du paiement : on revérifie chez le prestataire (jamais l'adresse de retour seule). */
export default async function MerciCadeauPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c } = await searchParams;
  const id = String(c ?? "").replace(/[^a-z0-9]/gi, "").slice(0, 40);
  let card = id ? await prisma.giftCard.findUnique({ where: { id }, select: { status: true, recipientName: true, amount: true } }) : null;
  if (card?.status === "EN_ATTENTE") {
    await settlePendingPayment(`${GIFT_PREFIX}${id}`);
    card = await prisma.giftCard.findUnique({ where: { id }, select: { status: true, recipientName: true, amount: true } });
  }
  const paid = card && card.status !== "EN_ATTENTE" && card.status !== "ANNULEE";
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      {paid ? <CheckCircle2 size={48} className="mx-auto text-emerald-600" /> : <Clock size={48} className="mx-auto text-navy/50" />}
      <h1 className="mt-4 font-serif-display text-3xl text-navy">{paid ? "Merci, votre cadeau est parti !" : "Paiement en cours de vérification"}</h1>
      <p className="mt-3 text-navy/75">
        {paid
          ? `${card!.recipientName.split(" ")[0]} vient de recevoir sa carte cadeau de ${card!.amount.toLocaleString("fr-FR")} FCFA sur WhatsApp.`
          : "Dès que le paiement est confirmé, la carte est envoyée automatiquement sur WhatsApp. Rechargez cette page dans un instant."}
      </p>
      <Link href="/" className="mt-8 inline-flex rounded-full bg-navy px-6 py-3 font-semibold text-white hover:bg-navy-light">Retour à la boutique</Link>
    </div>
  );
}
