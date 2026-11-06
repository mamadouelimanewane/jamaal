import { getT } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { checkReviewToken } from "@/lib/review-token";
import { OrderReviewForm } from "@/components/OrderReviewForm";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Votre avis | JAMAAL"), robots: { index: false } };
}

export default async function OrderReviewPage({ params, searchParams }: { params: Promise<{ orderId: string }>; searchParams: Promise<{ t?: string }> }) {
  const tr = await getT();
  const { orderId } = await params;
  const { t } = await searchParams;
  if (!checkReviewToken(orderId, t)) notFound();
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { customerName: true, items: { select: { productId: true, productName: true } } } });
  if (!order) notFound();
  const already = await prisma.review.count({ where: { orderId } });
  const products = [...new Map(order.items.filter((i) => i.productId).map((i) => [i.productId!, { id: i.productId!, name: i.productName }])).values()];
  const firstName = order.customerName.split(/\s+/)[0] ?? "";
  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ia">{tr("Votre avis compte")}</p>
      <h1 className="mt-2 font-serif-display text-2xl font-semibold text-navy">{tr("Comment trouvez-vous vos produits")}{firstName ? `, ${firstName}` : ""} ?</h1>
      <p className="mt-2 text-sm text-navy/70">{tr("Une note par produit suffit. Une photo aide beaucoup les autres clients.")}</p>
      <div className="mt-6">
        {already ? (
          <p className="rounded-2xl border border-ia/30 bg-ia-light/50 p-6 text-center text-sm text-navy">{tr("Merci, votre avis a déjà été enregistré 🌸")}</p>
        ) : (
          <OrderReviewForm orderId={orderId} token={t!} firstName={firstName} products={products} />
        )}
      </div>
    </div>
  );
}
