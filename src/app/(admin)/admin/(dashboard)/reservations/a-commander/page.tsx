import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-page-guard";
import { getOrderedBatches, pendingReservations } from "@/lib/reservation-orders";
import { AutoRefresh } from "@/components/admin/AutoRefresh";
import { CopyButton } from "@/components/admin/CopyButton";
import { PrintButton } from "@/components/admin/PrintButton";
import { MarkOrderedButton } from "@/components/admin/MarkOrderedButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "À commander chez Chogan (réservations)" };

const dateTime = (d: Date | string) => new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export default async function ReservedToOrderPage() {
  await requireAdminPage();
  const asOf = new Date();
  const [{ lines, units, orders, since }, batches] = await Promise.all([pendingReservations(asOf), getOrderedBatches()]);
  const listText = [
    `Réservations à commander chez Chogan — ${asOf.toLocaleDateString("fr-FR")}`,
    ...lines.map((l) => `${l.code ?? "?"}\t${l.quantity}\t${l.name} (${l.format})`),
    `Total : ${units} article(s)`,
  ].join("\n");

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin/reservations" className="text-xs text-navy/70 hover:underline">← Réservations</Link>
          <h1 className="mt-1 font-serif-display text-2xl font-semibold text-navy">À commander chez Chogan</h1>
          <p className="mt-1 max-w-2xl text-sm text-navy/75">
            Les produits réservés par les clients (acompte payé) et pas encore commandés à votre fournisseur. La liste se met à jour toute seule à chaque nouvelle réservation. Une fois la commande passée chez Chogan, confirmez-la : le compteur repart à zéro.
          </p>
          <div className="mt-1"><AutoRefresh everySeconds={15} /></div>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <CopyButton text={listText} label="Copier la liste" />
          <PrintButton />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className={`rounded-2xl border p-5 ${units > 0 ? "border-amber-300 bg-amber-50" : "border-line bg-white"}`}>
          <p className="text-xs uppercase tracking-wide text-navy/60">À commander</p>
          <p className="text-4xl font-semibold text-navy">{units}</p>
          <p className="text-xs text-navy/65">article{units > 1 ? "s" : ""}</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-5"><p className="text-xs uppercase tracking-wide text-navy/60">Produits différents</p><p className="text-3xl font-semibold text-navy">{lines.length}</p></div>
        <div className="rounded-2xl border border-line bg-white p-5"><p className="text-xs uppercase tracking-wide text-navy/60">Réservations</p><p className="text-3xl font-semibold text-navy">{orders}</p><p className="text-xs text-navy/65">{since ? `depuis la commande du ${dateTime(since)}` : "depuis le début"}</p></div>
      </div>

      {lines.length === 0 ? (
        <p className="rounded-2xl border border-line bg-white p-8 text-center text-sm text-navy/70">Compteur à zéro : aucune réservation en attente de commande chez Chogan.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full text-sm">
            <thead className="bg-cream text-left text-xs uppercase text-navy/70">
              <tr><th className="px-3 py-2">Code</th><th className="px-3 py-2">Produit</th><th className="px-3 py-2">Format</th><th className="px-3 py-2 text-right">Quantité</th><th className="px-3 py-2">Clients (acompte payé)</th></tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.key} className="border-t border-line align-top">
                  <td className="px-3 py-2 font-mono text-xs text-navy/80">{l.code ?? "—"}</td>
                  <td className="px-3 py-2 font-medium text-navy">{l.name}</td>
                  <td className="px-3 py-2 text-navy/80">{l.format}</td>
                  <td className="px-3 py-2 text-right text-lg font-semibold text-navy">{l.quantity}</td>
                  <td className="px-3 py-2 text-xs text-navy/75">
                    {l.customers.map((c) => (
                      <p key={c.orderId}>
                        <Link href={`/admin/commandes/${c.orderId}`} className="underline">{c.name}</Link>
                        {c.quantity > 1 ? ` × ${c.quantity}` : ""} · {c.phone ?? "sans téléphone"} · payé le {dateTime(c.paidAt)}
                      </p>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <MarkOrderedButton asOf={asOf.toISOString()} units={units} />

      <section className="print:hidden">
        <h2 className="mb-2 font-semibold text-navy">Commandes déjà passées chez Chogan</h2>
        {batches.length === 0 ? (
          <p className="text-sm text-navy/65">Aucune commande enregistrée pour l&apos;instant.</p>
        ) : (
          <ul className="space-y-2">
            {batches.map((b) => (
              <li key={b.at} className="rounded-xl border border-line bg-white px-4 py-3 text-sm">
                <p className="font-medium text-navy">{dateTime(b.at)} · {b.units} article{b.units > 1 ? "s" : ""} · par {b.by}</p>
                <p className="mt-1 text-xs text-navy/70">{b.lines.map((l) => `${l.qty} × ${l.name} (${l.format})`).join(" · ")}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
