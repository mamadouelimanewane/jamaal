import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ArrowLeft, Zap, CheckCircle, Clock, XCircle } from "lucide-react";
import { formatPrice } from "@/lib/currency";

export const dynamic = "force-dynamic";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  PENDING: {
    label: "En attente",
    color: "bg-amber-50 text-amber-700",
    icon: <Clock size={14} />,
  },
  PAID: {
    label: "Versé",
    color: "bg-emerald-50 text-emerald-700",
    icon: <CheckCircle size={14} />,
  },
  EXPIRED: {
    label: "Expiré",
    color: "bg-red-50 text-red-600",
    icon: <XCircle size={14} />,
  },
};

export default async function FastStartPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const consultant = await prisma.consultant.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!consultant) notFound();

  const bonuses = await prisma.fastStartBonus.findMany({
    where: { sponsorId: id },
    include: {
      sponsoree: { select: { id: true, name: true, city: true, createdAt: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const totalEarned = bonuses.filter((b) => b.status === "PAID").reduce((s, b) => s + b.amount, 0);
  const totalPending = bonuses.filter((b) => b.status === "PENDING").reduce((s, b) => s + b.amount, 0);

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={`/admin/consultants/${id}`}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-white text-navy hover:bg-cream transition-colors"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <Zap size={20} className="text-amber-500" />
            <h1 className="font-serif-display text-2xl font-semibold text-navy">
              Fast-Start Bonus — {consultant.name}
            </h1>
          </div>
          <p className="text-xs text-navy/50 mt-0.5">
            Prime versée lorsqu&apos;un filleul réalise 50 000 FCFA de CA dans ses 30 premiers jours.
          </p>
        </div>
      </div>

      {/* KPI */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-white p-5 shadow-sm text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-navy/50">Bonus versés</p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">{formatPrice(totalEarned)}</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-5 shadow-sm text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-navy/50">Bonus en attente</p>
          <p className="mt-2 text-2xl font-bold text-amber-500">{formatPrice(totalPending)}</p>
        </div>
        <div className="rounded-2xl border border-line bg-white p-5 shadow-sm text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-navy/50">Total filleuls éligibles</p>
          <p className="mt-2 text-2xl font-bold text-navy">{bonuses.length}</p>
        </div>
      </div>

      {/* Règle du jeu */}
      <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50/60 px-5 py-4 text-sm text-amber-900">
        <p className="font-semibold flex items-center gap-2"><Zap size={16} />Comment fonctionne le Fast-Start Bonus ?</p>
        <ul className="mt-2 space-y-1 text-xs list-disc list-inside">
          <li>Quand vous parrainez un nouveau consultant, le système surveille ses 30 premiers jours.</li>
          <li>Si son CA atteint <strong>50 000 FCFA</strong> dans ce délai, un bonus de <strong>15 000 FCFA</strong> vous est automatiquement attribué.</li>
          <li>Le statut passe de &quot;En attente&quot; à &quot;Versé&quot; une fois que l&apos;admin enregistre le paiement.</li>
        </ul>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-line bg-white shadow-sm overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className="font-semibold text-navy">Historique des bonus</h2>
        </div>
        {bonuses.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-navy/40">
            Aucun bonus Fast-Start pour l&apos;instant. Recrutez et formez vos filleuls pour en bénéficier !
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-cream text-left text-xs uppercase text-navy/50">
              <tr>
                <th className="px-4 py-3">Filleul</th>
                <th className="px-4 py-3">Date recrutement</th>
                <th className="px-4 py-3">Montant</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Versé le</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {bonuses.map((b) => {
                const cfg = STATUS_CONFIG[b.status] ?? STATUS_CONFIG.PENDING;
                return (
                  <tr key={b.id} className="hover:bg-cream/40 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/admin/consultants/${b.sponsoree.id}`} className="font-medium text-navy hover:underline">
                        {b.sponsoree.name}
                      </Link>
                      <p className="text-xs text-navy/50">{b.sponsoree.city}</p>
                    </td>
                    <td className="px-4 py-3 text-navy/60">
                      {b.sponsoree.createdAt.toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-4 py-3 font-bold text-navy">{formatPrice(b.amount)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${cfg.color}`}>
                        {cfg.icon} {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-navy/60">
                      {b.awardedAt ? b.awardedAt.toLocaleDateString("fr-FR") : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
