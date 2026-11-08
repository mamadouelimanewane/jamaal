import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ConsultantOrderForm } from "@/components/admin/ConsultantOrderForm";
import { prisma } from "@/lib/prisma";
import { getBusinessModel } from "@/lib/business-model-store";
import { walletBalance } from "@/lib/wallet";
import { activeTerms, allowedCollect, parseZones } from "@/lib/special-terms";
import { getAvailablePaymentProviders } from "@/lib/payment";
import { getInstallmentSettings } from "@/lib/installments-store";
import type { LineItem } from "@/components/admin/ConsultantOrderForm";

/** Produits passés dans l'adresse (?produits=slug1,slug2), au premier format en stock. */
async function preselected(raw: string | undefined, format: string | undefined): Promise<LineItem[]> {
  const slugs = (raw ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 10);
  if (!slugs.length) return [];
  const rows = await prisma.product.findMany({ where: { slug: { in: slugs } }, select: { id: true, slug: true, name: true, regularPrice: true, volumes: true, photo: true, variants: { select: { volumeLabel: true, stock: true } } } });
  return slugs.flatMap((slug) => {
    const p = rows.find((r) => r.slug === slug);
    if (!p) return [];
    const volumes = ((p.volumes as { label: string; price: number }[] | null) ?? []).filter((v) => v && v.label && v.price > 0);
    const stock: Record<string, number> = Object.fromEntries(p.variants.map((x) => [x.volumeLabel, x.stock]));
    const v = volumes.find((x) => x.label === format) ?? volumes.find((x) => (stock[x.label] ?? 1) > 0) ?? volumes[0];
    if (v) return [{ productId: p.id, productName: p.name, volumeLabel: v.label, price: v.price, quantity: 1, options: volumes, photo: p.photo }];
    return p.regularPrice ? [{ productId: p.id, productName: p.name, volumeLabel: "Format unique", price: p.regularPrice, quantity: 1, photo: p.photo }] : [];
  });
}

export default async function NewConsultantOrderPage({ searchParams }: { searchParams: Promise<{ produits?: string; format?: string; pour?: string }> }) {
  const sp = await searchParams;
  const session = await auth();
  if (session?.user?.role !== "CONSULTANT") redirect("/admin");
  const [user, model] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user!.id }, select: { consultant: { select: { id: true, name: true, whatsapp: true, deliveryAddress: true, deliveryLat: true, deliveryLng: true, specialTerms: true } } } }),
    getBusinessModel(),
  ]);
  const me = user?.consultant;
  // Solde utilisable pour payer (commissions en vérification exclues).
  const wallet = me ? (await walletBalance({ type: "CONSULTANT", id: me.id })).available : 0;
  const terms = activeTerms(me?.specialTerms);
  const [installments, initialItems] = await Promise.all([getInstallmentSettings(), preselected(sp.produits, sp.format)]);
  const onlinePay = getAvailablePaymentProviders(model).filter((p) => p.id !== "cod").map((p) => ({ id: p.id, label: p.label }));
  const special = terms ? { collect: allowedCollect(terms), creditLimit: terms.creditLimit, zones: parseZones(terms.zones) } : null;

  return (
    <div>
      <h1 className="font-serif-display text-2xl font-semibold text-navy">
        Acheter un produit
      </h1>
      <p className="mt-1 text-sm text-navy/75">
        Cherchez le produit (nom, code ou parfum d&apos;inspiration), puis achetez pour vous-même ou pour un client. Payez avec votre wallet (vos commissions, sans les retirer), avec Wave ou Orange Money, par un lien envoyé au client, ou à la livraison.
      </p>
      <ConsultantOrderForm depot={{ lat: model.depotLat, lng: model.depotLng, label: model.depotLabel }} vendor={{ address: me?.deliveryAddress ?? null, lat: me?.deliveryLat ?? null, lng: me?.deliveryLng ?? null }} walletBalance={wallet} special={special} onlinePay={onlinePay} installments={installments} me={me ? { name: me.name, phone: me.whatsapp } : null} initialItems={initialItems} initialForSelf={sp.pour === "moi"} />
    </div>
  );
}
