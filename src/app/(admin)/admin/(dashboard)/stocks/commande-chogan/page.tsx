import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-page-guard";
import { prisma } from "@/lib/prisma";
import { getStockRows } from "@/lib/inventory-report";
import { getOrderedUntil } from "@/lib/reservation-orders";
import { applyChoganPrice, dismissChoganPrice } from "@/lib/actions/growth";
import { CopyButton } from "@/components/admin/CopyButton";
import { PrintButton } from "@/components/admin/PrintButton";
import { formatPrice } from "@/lib/currency";

export const dynamic = "force-dynamic";

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
export const metadata = { title: "Commande Chogan" };

export default async function ChoganOrderPage({ searchParams }: { searchParams: Promise<{ tout?: string }> }) {
  await requireAdminPage("stocks");
  const all = (await searchParams).tout === "1";
  const orderedUntil = await getOrderedUntil();
  const [rows, reservations, changes, watched, total] = await Promise.all([
    getStockRows(),
    prisma.orderItem.findMany({
      // Seules les réservations pas encore commandées chez Chogan (voir « À commander (réservations) »).
      where: { order: { isReservation: true, reservationStatus: "RESERVEE", status: { not: "ANNULEE" }, ...(orderedUntil ? { depositPaidAt: { gt: orderedUntil } } : {}) } },
      select: { productId: true, volumeLabel: true, productName: true, quantity: true },
    }),
    prisma.choganPriceChange.findMany({ where: { seen: false }, orderBy: { detectedAt: "desc" }, take: 50 }).then(async (list) => {
      const nums = new Map((await prisma.product.findMany({ where: { id: { in: list.map((c) => c.productId) } }, select: { id: true, number: true } })).map((p) => [p.id, p.number]));
      return list.map((c) => ({ ...c, number: nums.get(c.productId) ?? null, odd: c.oldPublic != null && c.oldPublic > 0 && (c.newPublic / c.oldPublic > 1.6 || c.newPublic / c.oldPublic < 0.6) }));
    }),
    prisma.product.count({ where: { number: { not: null }, choganCheckedAt: { gte: daysAgo(30) } } }),
    prisma.product.count({ where: { number: { not: null } } }),
  ]);
  // Réservations payées (acompte reçu) : à commander en plus du réassort.
  const reserved = new Map<string, number>();
  for (const r of reservations) {
    const key = `${r.productId}|${r.volumeLabel}`;
    reserved.set(key, (reserved.get(key) ?? 0) + r.quantity);
  }
  const lines = rows
    .map((r) => ({ ...r, reserved: reserved.get(`${r.productId}|${r.format}`) ?? 0 }))
    .map((r) => ({ ...r, qty: r.toOrder + r.reserved }))
    // Par défaut : seulement ce qui se vend (ventes sur 30 jours) ou est réservé ; « tout » ajoute le réassort des seuils.
    .filter((r) => r.qty > 0 && (all || r.sold30 > 0 || r.reserved > 0))
    .sort((a, b) => b.sold30 - a.sold30 || b.qty - a.qty);
  const cost = lines.reduce((s, r) => s + r.qty * (r.unitCost ?? 0), 0);
  const units = lines.reduce((s, r) => s + r.qty, 0);
  const listText = [`Commande Chogan JAMAAL — ${new Date().toLocaleDateString("fr-FR")}`, ...lines.map((r) => `${r.code ?? r.productCode ?? "?"}\t${r.qty}\t${r.name} (${r.format})`), `Total : ${units} article(s)`].join("\n");
  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin/stocks" className="text-xs text-navy/70 hover:underline">← Stocks</Link>
          <h1 className="mt-1 font-serif-display text-2xl font-semibold text-navy">Commande Chogan</h1>
          <p className="mt-1 text-sm text-navy/75">Bon de commande préparé à partir des ventes des 30 derniers jours (de quoi tenir un mois, au moins 2 × le seuil) et des réservations payées. Copiez la liste dans votre commande Chogan.</p>
          <p className="mt-1 text-xs text-navy/65">
            {all ? (
              <>Affichage : tous les formats sous leur seuil. <Link href="/admin/stocks/commande-chogan" className="underline">Seulement ce qui se vend</Link></>
            ) : (
              <>Affichage : produits vendus ce mois-ci et réservations. <Link href="/admin/stocks/commande-chogan?tout=1" className="underline">Inclure tous les formats sous leur seuil</Link></>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <CopyButton text={listText} label="Copier la liste" />
          <PrintButton />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-white p-4"><p className="text-xs text-navy/60">Lignes</p><p className="text-xl font-semibold text-navy">{lines.length}</p></div>
        <div className="rounded-2xl border border-line bg-white p-4"><p className="text-xs text-navy/60">Articles</p><p className="text-xl font-semibold text-navy">{units}</p></div>
        <div className="rounded-2xl border border-line bg-white p-4"><p className="text-xs text-navy/60">Coût estimé</p><p className="text-xl font-semibold text-navy">{formatPrice(cost)}</p></div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full text-sm">
          <thead className="bg-cream text-left text-xs uppercase text-navy/70">
            <tr><th className="px-3 py-2">Code</th><th className="px-3 py-2">Produit</th><th className="px-3 py-2">Stock</th><th className="px-3 py-2">Ventes 30 j</th><th className="px-3 py-2">Réservé</th><th className="px-3 py-2">À commander</th><th className="px-3 py-2">Coût</th></tr>
          </thead>
          <tbody>
            {lines.map((r) => (
              <tr key={r.key} className="border-t border-line">
                <td className="px-3 py-2 font-mono text-xs">{r.code ?? r.productCode ?? "—"}</td>
                <td className="px-3 py-2 text-navy">{r.name} <span className="text-navy/55">· {r.format}</span></td>
                <td className={`px-3 py-2 ${r.stock <= 0 ? "font-semibold text-rose-dark" : ""}`}>{r.stock}</td>
                <td className="px-3 py-2">{r.sold30}</td>
                <td className="px-3 py-2">{r.reserved || ""}</td>
                <td className="px-3 py-2 font-semibold text-ia-dark">{r.qty}</td>
                <td className="px-3 py-2">{r.unitCost ? formatPrice(r.qty * r.unitCost) : "—"}</td>
              </tr>
            ))}
            {!lines.length && <tr><td colSpan={7} className="px-3 py-8 text-center text-navy/70">Rien à commander : le stock couvre les ventes du mois.</td></tr>}
          </tbody>
        </table>
      </div>

      <section className="rounded-2xl border border-line bg-white p-5 print:hidden">
        <h2 className="font-semibold text-navy">Veille des prix Chogan</h2>
        <p className="mt-1 text-sm text-navy/70">Chaque soir, une partie du catalogue est comparée au site Chogan ({watched} / {total} fiches vérifiées sur 30 jours). Un changement de prix public apparaît ici : appliquez-le (prix public et prix de vente JAMAAL recalculés selon le modèle économique) ou ignorez-le.</p>
        <ul className="mt-3 divide-y divide-line text-sm">
          {changes.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
              <span className="text-navy">
                {c.name} : {c.oldPublic != null ? formatPrice(c.oldPublic) : "?"} → <strong>{formatPrice(c.newPublic)}</strong>
                <span className="ml-2 text-xs text-navy/55">{c.detectedAt.toLocaleDateString("fr-FR")}</span>
                {c.odd && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">Écart inhabituel : vérifiez</span>}
                {c.number && <a href={`https://www.chogangroupspa.com/chogangroup/productDetail/${c.number}`} target="_blank" rel="noopener noreferrer" className="ml-2 text-xs underline">fiche Chogan ↗</a>}
              </span>
              <span className="flex gap-2 text-xs font-semibold">
                <form action={applyChoganPrice.bind(null, c.id)}><button className="rounded-full bg-ia px-3 py-1.5 text-white">Appliquer</button></form>
                <form action={dismissChoganPrice.bind(null, c.id)}><button className="rounded-full border border-line px-3 py-1.5 text-navy">Ignorer</button></form>
              </span>
            </li>
          ))}
          {!changes.length && <li className="py-3 text-navy/60">Aucun changement de prix détecté.</li>}
        </ul>
      </section>
    </div>
  );
}
