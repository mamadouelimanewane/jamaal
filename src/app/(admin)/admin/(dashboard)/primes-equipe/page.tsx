import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/currency";
import { getBusinessModel } from "@/lib/business-model-store";
import { computeTeamPrimes, monthKey, monthRange, primeRef } from "@/lib/team";
import { ClosePrimesForm } from "@/components/admin/ClosePrimesForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Primes d'équipe" };

function lastMonths(n: number) {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)));
}

export default async function TeamPrimesPage({ searchParams }: { searchParams: Promise<{ mois?: string }> }) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/admin");
  const months = lastMonths(7);
  const current = months[0];
  const { mois } = await searchParams;
  const key = mois && monthRange(mois) ? mois : months[1];
  const range = monthRange(key)!;
  const model = await getBusinessModel();
  const [rows, entries] = await Promise.all([
    computeTeamPrimes(key, model),
    prisma.commissionEntry.findMany({ where: { orderId: primeRef(key) }, select: { consultantId: true, amount: true, status: true } }),
  ]);
  const paid = new Map(entries.map((e) => [e.consultantId, e]));
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const closed = entries.length > 0;

  return (
    <div className="max-w-5xl">
      <h1 className="font-serif-display text-2xl font-semibold text-navy">Primes d&apos;équipe</h1>
      <p className="mt-1 text-sm text-navy/75">
        Leader : prime selon le CA du mois de toute son équipe. Parrain : selon le CA de ses Consultants. Paliers dans le{" "}
        <Link href="/admin/modele-economique" className="font-semibold text-rose-dark hover:underline">Modèle économique</Link>.
        {!model.teamPrimesEnabled && <strong className="text-amber-800"> Les primes d&apos;équipe sont désactivées : ce tableau est une simulation.</strong>}
      </p>

      <nav className="mt-5 flex flex-wrap gap-2" aria-label="Mois">
        {months.map((m) => (
          <Link key={m} href={`/admin/primes-equipe?mois=${m}`} aria-current={m === key ? "page" : undefined} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${m === key ? "bg-navy text-white" : "border border-line bg-white text-navy hover:border-navy"}`}>
            {monthRange(m)!.label}{m === current ? " (en cours)" : ""}
          </Link>
        ))}
      </nav>

      <section className="mt-5 rounded-2xl border border-line bg-white p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold capitalize text-ink">{range.label}</h2>
            <p className="text-sm text-navy/75">{rows.filter((r) => r.amount > 0).length} prime(s) · total {formatPrice(total)}{closed ? " · mois clôturé" : ""}</p>
          </div>
          {key !== current && !closed && model.teamPrimesEnabled && total > 0 && <ClosePrimesForm month={key} label={range.label} total={total} />}
        </div>
        {rows.length === 0 ? (
          <p className="mt-3 text-[15px] text-navy/80">Aucun Leader ni Parrain avec une équipe active ce mois-là.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-xs uppercase text-navy/70">
                <tr>
                  <th className="pb-2">Membre</th>
                  <th className="pb-2">Rang</th>
                  <th className="pb-2 text-right">Équipe</th>
                  <th className="pb-2 text-right">CA d&apos;équipe</th>
                  <th className="pb-2 text-right">Palier</th>
                  <th className="pb-2 text-right">Prime</th>
                  <th className="pb-2 text-right">État</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const e = paid.get(r.consultantId);
                  return (
                    <tr key={r.consultantId} className="border-t border-line">
                      <td className="py-2.5"><Link href={`/admin/consultants/${r.consultantId}`} className="font-semibold text-navy hover:underline">{r.name}</Link></td>
                      <td className="py-2.5">{r.title}</td>
                      <td className="py-2.5 text-right">{r.members}</td>
                      <td className="py-2.5 text-right">{formatPrice(r.teamSales)}</td>
                      <td className="py-2.5 text-right">{r.tier ? formatPrice(r.tier.threshold) : "—"}</td>
                      <td className="py-2.5 text-right font-semibold text-emerald-800">{r.amount ? formatPrice(r.amount) : "—"}</td>
                      <td className="py-2.5 text-right text-xs">{e ? (e.status === "VERSE" ? "versée" : e.status === "ANNULE" ? "annulée" : "à verser") : key === current ? "en cours" : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
