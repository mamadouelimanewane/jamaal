import type { Metadata } from "next";
import { Globe2, MessageCircle, Truck } from "lucide-react";
import { getBusinessModel } from "@/lib/business-model-store";
import { getAvailablePaymentProviders } from "@/lib/payment";
import { GiftCardForm } from "@/components/gift/GiftCardForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Carte cadeau JAMAAL : offrez un parfum à distance",
  description: "Depuis Paris, Milan, New York ou Dakar : offrez une carte cadeau JAMAAL, envoyée sur WhatsApp avec votre message (même vocal). Livraison à domicile au Sénégal.",
};

export default async function CarteCadeauPage({ searchParams }: { searchParams: Promise<{ ref?: string; annule?: string }> }) {
  const { ref, annule } = await searchParams;
  const methods = getAvailablePaymentProviders(await getBusinessModel()).filter((p) => p.id !== "cod").map((p) => ({ id: p.id, label: p.label }));
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <section className="max-w-3xl">
        <p className="luxury-eyebrow">Offrir à distance</p>
        <h1 className="mt-2 font-serif-display text-4xl font-semibold leading-tight text-navy sm:text-5xl">Faites plaisir à vos proches, où que vous soyez</h1>
        <p className="mt-4 text-base leading-relaxed text-navy/75">Une carte cadeau JAMAAL envoyée sur WhatsApp, avec votre message écrit ou vocal. Votre proche choisit ses parfums et ses soins, livrés chez lui.</p>
        <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-navy/80">
          <li className="flex gap-2"><Globe2 size={18} className="text-rose-dark" /> Payez depuis l&apos;étranger</li>
          <li className="flex gap-2"><MessageCircle size={18} className="text-rose-dark" /> Reçue sur WhatsApp en quelques minutes</li>
          <li className="flex gap-2"><Truck size={18} className="text-rose-dark" /> Livraison comprise dans la carte</li>
        </ul>
        <p className="mt-4 text-sm text-navy/70">Vous savez déjà quel parfum offrir ? Ajoutez-le au panier et choisissez « C&apos;est un cadeau » : nous le livrons à votre proche avec votre message.</p>
      </section>
      <div className="mt-10"><GiftCardForm methods={methods} refSlug={ref ?? null} cancelled={annule === "1"} /></div>
    </div>
  );
}
