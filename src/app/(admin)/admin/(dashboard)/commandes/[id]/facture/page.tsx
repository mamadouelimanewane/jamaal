import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/currency";
import { BrandLogo } from "@/components/BrandLogo";

export const dynamic = "force-dynamic";

export default async function OrderInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: true,
      consultant: { select: { name: true, city: true, whatsapp: true } },
      livreur: { select: { name: true, phone: true } },
    },
  });

  if (!order) notFound();

  const subtotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8 print:bg-white print:p-0">
      {/* Barre d'action d'impression (masquée lors de l'impression) */}
      <div className="mx-auto mb-6 flex max-w-3xl items-center justify-between print:hidden">
        <a
          href={`/admin/commandes/${order.id}`}
          className="text-xs font-semibold text-navy hover:underline"
        >
          ← Retour à la commande
        </a>
        <button
          onClick={() => {}}
          className="rounded-full bg-navy px-5 py-2 text-sm font-semibold text-white shadow hover:bg-navy-light"
          /* Note: Sur une page serveur, on peut mettre un composant client pour window.print() ou un script simple */
        >
          🖨️ Imprimer / Enregistrer en PDF
        </button>
      </div>

      {/* Printable invoice card */}
      <div className="mx-auto max-w-3xl rounded-2xl border border-line bg-white p-8 shadow-sm print:rounded-none print:border-none print:shadow-none">
        {/* Header avec Logo & Infos Entreprise */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-6">
          <div>
            <BrandLogo height={96} />
            <h1 className="sr-only">JAMAAL Luxury Cosmetics — Facture</h1>
            <p className="mt-1 text-xs font-medium uppercase tracking-widest text-rose-dark">
              Luxury Cosmetics
            </p>
            <p className="mt-2 text-xs text-navy/75">
              Dakar, Sénégal
              <br />
              Contact: +221 77 000 00 00
              <br />
              Email: contact@jamaal-cosmetics.com
            </p>
          </div>

          <div className="text-right">
            <h2 className="font-serif-display text-xl font-bold text-navy">FACTURE</h2>
            <p className="mt-1 font-mono text-xs font-semibold text-navy/85">
              N° FA-{order.id.slice(-8).toUpperCase()}
            </p>
            <p className="mt-1 text-xs text-navy/75">
              Date : {order.createdAt.toLocaleDateString("fr-FR")}
            </p>
            <p className="text-xs text-navy/75">
              Statut : <span className="font-semibold text-emerald-700">{order.status}</span>
            </p>
          </div>
        </div>

        {/* Coordonnées Client & Facturation */}
        <div className="mt-6 grid grid-cols-2 gap-4 border-b border-line pb-6 text-xs">
          <div>
            <p className="font-semibold uppercase tracking-wider text-navy/65">Facturé à :</p>
            <p className="mt-1 text-sm font-bold text-navy">{order.customerName}</p>
            {order.customerPhone && <p className="text-navy/85">Tél : {order.customerPhone}</p>}
            {order.customerEmail && <p className="text-navy/85">Email : {order.customerEmail}</p>}
            {order.address && <p className="mt-1 text-navy/85">Adresse : {order.address}</p>}
          </div>

          <div className="text-right">
            <p className="font-semibold uppercase tracking-wider text-navy/65">Mode de livraison :</p>
            <p className="mt-1 font-medium text-navy">
              {order.deliveryMode === "LIVRAISON_JAMAAL"
                ? "Livraison directe JAMAAL"
                : "Retrait / Remise Consultant"}
            </p>
            {order.consultant && (
              <p className="mt-1 text-navy/85">Consultant : {order.consultant.name}</p>
            )}
            {order.livreur && (
              <p className="text-navy/85">Livreur : {order.livreur.name}</p>
            )}
          </div>
        </div>

        {/* Tableau des articles */}
        <div className="mt-6">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-navy/10 bg-cream/60 uppercase tracking-wider text-navy/75">
                <th className="py-2.5 px-3">Désignation</th>
                <th className="py-2.5 px-3">Format</th>
                <th className="py-2.5 px-3 text-center">Quantité</th>
                <th className="py-2.5 px-3 text-right">Prix Unit.</th>
                <th className="py-2.5 px-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {order.items.map((item) => (
                <tr key={item.id}>
                  <td className="py-3 px-3 font-medium text-navy">{item.productName}</td>
                  <td className="py-3 px-3 text-navy/85">{item.volumeLabel}</td>
                  <td className="py-3 px-3 text-center font-semibold text-navy">{item.quantity}</td>
                  <td className="py-3 px-3 text-right text-navy/85">{formatPrice(item.price)}</td>
                  <td className="py-3 px-3 text-right font-medium text-navy">
                    {formatPrice(item.price * item.quantity)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totaux & Réductions */}
        <div className="mt-6 flex flex-col items-end border-t border-line pt-4 text-xs">
          <div className="w-full max-w-xs space-y-2">
            <div className="flex justify-between text-navy/85">
              <span>Sous-total HT</span>
              <span>{formatPrice(subtotal)}</span>
            </div>

            {order.deliveryFee > 0 && (
              <div className="flex justify-between text-navy/85">
                <span>Frais de livraison</span>
                <span>{formatPrice(order.deliveryFee)}</span>
              </div>
            )}

            {order.discountAmount > 0 && (
              <div className="flex justify-between font-semibold text-rose-dark">
                <span>Réduction (Code / Fidélité)</span>
                <span>- {formatPrice(order.discountAmount)}</span>
              </div>
            )}

            <div className="flex justify-between border-t border-navy/20 pt-2 text-sm font-bold text-navy">
              <span>Total Net à payer</span>
              <span>{formatPrice(order.total)}</span>
            </div>
          </div>
        </div>

        {/* Footer facture */}
        <div className="mt-12 border-t border-line pt-6 text-center text-xs text-navy/65">
          <p>Merci pour votre confiance ! Pour toute question concernant cette facture, contactez notre support.</p>
          <p className="mt-0.5">JAMAAL Luxury Cosmetics — Parfums & Cosmétiques d&apos;exception</p>
        </div>
      </div>

      {/* Script d'impression automatique quand la page s'ouvre avec ?print=true */}
      <script
        dangerouslySetInnerHTML={{
          __html: `if (new URLSearchParams(window.location.search).get('print') === 'true') { window.print(); }`,
        }}
      />
    </div>
  );
}
