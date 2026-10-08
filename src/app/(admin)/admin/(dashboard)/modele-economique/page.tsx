import { Calculator } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdminPage } from "@/lib/admin-page-guard";
import { getBusinessModel } from "@/lib/business-model-store";
import { salePriceFromPublic } from "@/lib/business-model";
import { BusinessModelEditor } from "@/components/admin/BusinessModelEditor";
import { isCashFallbackActive, paymentProvidersStatus } from "@/lib/payment";

export const dynamic = "force-dynamic";

export default async function BusinessModelPage() {
  await requireAdminPage();
  const [model, products] = await Promise.all([
    getBusinessModel(),
    prisma.product.findMany({ where: { publicPrice: { gt: 0 } }, select: { publicPrice: true, regularPrice: true } }),
  ]);
  const toReprice = products.filter((p) => salePriceFromPublic(p.publicPrice!, model) !== p.regularPrice).length;

  return (
    <div className="max-w-6xl">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy text-white">
          <Calculator size={20} />
        </div>
        <div>
          <h1 className="font-serif-display text-2xl font-semibold text-navy">Modèle économique</h1>
          <p className="text-sm text-navy/75">
            Prix, commissions du réseau et primes. Ces valeurs pilotent les prix du catalogue et les gains affichés aux consultants.
          </p>
        </div>
      </div>
      {isCashFallbackActive(model) && (
        <div className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-[15px] text-amber-950">
          <p className="font-semibold">Paiement à la livraison proposé en secours</p>
          <p className="mt-1">
            Aucun paiement en ligne n&apos;est encore branché ({paymentProvidersStatus(model).filter((p) => p.id !== "cod").map((p) => `${p.label} : ${p.configured ? "configuré" : "non configuré"}`).join(" · ")}).
            Pour ne pas bloquer les ventes, le panier propose le paiement à la livraison. Il disparaîtra automatiquement dès que Wave ou Orange Money sera configuré dans Vercel.
          </p>
        </div>
      )}
      <div className="mt-8">
        <BusinessModelEditor model={model} productsWithPublicPrice={products.length} productsToReprice={toReprice} />
      </div>
    </div>
  );
}
