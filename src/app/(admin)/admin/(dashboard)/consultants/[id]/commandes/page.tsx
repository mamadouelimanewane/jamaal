import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/currency";
import { OrderStatus } from "@prisma/client";
import { ArrowLeft, Download } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<OrderStatus, string> = {
  EN_ATTENTE: "En attente",
  CONFIRMEE: "Confirmée",
  EXPEDIEE: "Expédiée",
  LIVREE: "Livrée",
  ANNULEE: "Annulée",
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  EN_ATTENTE: "bg-amber-50 text-amber-700",
  CONFIRMEE: "bg-blue-50 text-blue-700",
  EXPEDIEE: "bg-purple-50 text-purple-700",
  LIVREE: "bg-emerald-50 text-emerald-700",
  ANNULEE: "bg-red-50 text-red-600",
};

export default async function ConsultantCommandesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { id } = await params;
  const { status, q = "" } = await searchParams;

  const consultant = await prisma.consultant.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!consultant) notFound();

  const orders = await prisma.order.findMany({
    where: {
      consultantId: id,
      ...(status ? { status: status as OrderStatus } : {}),
      ...(q
        ? {
            OR: [
              { customerName: { contains: q, mode: "insensitive" } },
              { customerPhone: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { items: true },
  });

  const totalNet = orders
    .filter((o) => o.status !== "ANNULEE")
    .reduce((sum, o) => sum + o.total, 0);

  const countByStatus = orders.reduce(
    (acc, o) => {
      acc[o.status] = (acc[o.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/consultants/${id}`}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-white text-navy hover:bg-cream"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="font-serif-display text-2xl font-semibold text-navy">
              Commandes — {consultant.name}
            </h1>
            <p className="text-sm text-navy/75">
              {orders.length} commande(s) affichée(s) — CA net :{" "}
              <span className="font-semibold text-navy">{formatPrice(totalNet)}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Stats rapides */}
      <div className="mt-4 flex flex-wrap gap-2">
        {(Object.keys(STATUS_LABELS) as OrderStatus[]).map((s) => (
          <div
            key={s}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLORS[s]}`}
          >
            {STATUS_LABELS[s]} : {countByStatus[s] ?? 0}
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <form action={`/admin/consultants/${id}/commandes`} className="flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Rechercher un client…"
            className="rounded-full border border-line px-4 py-1.5 text-xs outline-none focus:border-navy"
          />
          {status && <input type="hidden" name="status" value={status} />}
        </form>
        <div className="flex flex-wrap gap-1.5">
          {(
            [undefined, "EN_ATTENTE", "CONFIRMEE", "EXPEDIEE", "LIVREE", "ANNULEE"] as const
          ).map((s) => (
            <Link
              key={s ?? "tous"}
              href={
                s
                  ? `/admin/consultants/${id}/commandes?status=${s}${q ? `&q=${q}` : ""}`
                  : `/admin/consultants/${id}/commandes${q ? `?q=${q}` : ""}`
              }
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                (s ?? "") === (status ?? "")
                  ? "border-navy bg-navy text-white"
                  : "border-line bg-white text-navy hover:bg-cream"
              }`}
            >
              {s ? STATUS_LABELS[s] : "Toutes"}
            </Link>
          ))}
        </div>
      </div>

      {/* Tableau */}
      <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full text-sm">
          <thead className="bg-cream text-left text-xs uppercase text-navy/70">
            <tr>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Articles</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Remise</th>
              <th className="px-4 py-3">Livraison</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-navy/65">
                  Aucune commande pour ce filtre.
                </td>
              </tr>
            )}
            {orders.map((o) => (
              <tr key={o.id} className="border-t border-line">
                <td className="px-4 py-3">
                  <p className="font-medium text-navy">{o.customerName}</p>
                  <p className="text-xs text-navy/70">{o.customerPhone ?? ""}</p>
                </td>
                <td className="px-4 py-3 text-navy/75">
                  {o.createdAt.toLocaleDateString("fr-FR")}
                </td>
                <td className="px-4 py-3 text-navy/75">{o.items.length} art.</td>
                <td className="px-4 py-3 font-semibold text-navy">
                  {formatPrice(o.total)}
                </td>
                <td className="px-4 py-3 text-navy/75">
                  {o.discountAmount > 0 ? (
                    <span className="text-rose-dark">- {formatPrice(o.discountAmount)}</span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-navy/75">
                  {o.deliveryMode === "LIVRAISON_JAMAAL" ? "JAMAAL" : "Consultant"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLORS[o.status]}`}
                  >
                    {STATUS_LABELS[o.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`/admin/commandes/${o.id}`}
                      className="text-xs font-semibold text-navy hover:underline"
                    >
                      Voir →
                    </Link>
                    <a
                      href={`/admin/commandes/${o.id}/facture`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-navy/65 hover:text-navy"
                    >
                      <Download size={13} />
                    </a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
