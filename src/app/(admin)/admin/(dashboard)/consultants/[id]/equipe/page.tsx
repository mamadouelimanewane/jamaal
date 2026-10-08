import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ArrowLeft, Users } from "lucide-react";
import { formatPrice } from "@/lib/currency";
import { getConsultantRank } from "@/lib/ranking";
import { getConsultantCommission } from "@/lib/commission";
import { TeamTree } from "@/components/admin/TeamTree";

export const dynamic = "force-dynamic";

interface TreeNode {
  id: string;
  name: string;
  city: string;
  monthlyRevenue: number;
  rank: string;
  children: TreeNode[];
}

async function buildTree(consultantId: string, depth = 0): Promise<TreeNode> {
  const consultant = await prisma.consultant.findUnique({
    where: { id: consultantId },
    select: { id: true, name: true, city: true, sponsored: { select: { id: true } } },
  });
  if (!consultant) throw new Error("Not found");

  const [rankInfo, commission] = await Promise.all([
    getConsultantRank(consultantId),
    getConsultantCommission(consultantId),
  ]);

  const children: TreeNode[] =
    depth < 2
      ? await Promise.all(consultant.sponsored.map((s) => buildTree(s.id, depth + 1)))
      : [];

  return {
    id: consultant.id,
    name: consultant.name,
    city: consultant.city,
    monthlyRevenue: commission.monthlyRevenue,
    rank: rankInfo.rank ?? "STARTER",
    children,
  };
}

export default async function EquipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const consultant = await prisma.consultant.findUnique({
    where: { id },
    include: {
      sponsored: {
        include: {
          orders: { select: { total: true, status: true } },
          sponsored: { select: { id: true, name: true, active: true } },
        },
      },
    },
  });
  if (!consultant) notFound();

  const tree = await buildTree(id);

  return (
    <div className="max-w-5xl">
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
            <Users size={20} className="text-blue-500" />
            <h1 className="font-serif-display text-2xl font-semibold text-navy">
              Équipe — {consultant.name}
            </h1>
          </div>
          <p className="text-xs text-navy/70 mt-0.5">
            {consultant.sponsored.length} filleul(s) direct(s) · Vue arbre sur 2 niveaux
          </p>
        </div>
      </div>

      {/* Arbre interactif */}
      <div className="mb-6">
        <h2 className="mb-3 font-semibold text-navy">Arbre généalogique du réseau</h2>
        {consultant.sponsored.length === 0 ? (
          <div className="rounded-2xl border border-line bg-white p-10 text-center text-navy/65 shadow-sm">
            <Users size={36} className="mx-auto mb-2 opacity-30" />
            <p>Aucun filleul pour le moment.</p>
          </div>
        ) : (
          <TeamTree data={tree} />
        )}
      </div>

      {/* Liste détaillée */}
      <div className="rounded-2xl border border-line bg-white shadow-sm overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className="font-semibold text-navy">Filleuls directs (N1)</h2>
        </div>
        {consultant.sponsored.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-navy/65">Aucun filleul enregistré.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-cream text-left text-xs uppercase text-navy/70">
              <tr>
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Ville</th>
                <th className="px-4 py-3">CA Total</th>
                <th className="px-4 py-3">N2 (filleuls)</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {consultant.sponsored.map((s) => {
                const ca = s.orders
                  .filter((o) => o.status !== "ANNULEE")
                  .reduce((sum, o) => sum + o.total, 0);
                return (
                  <tr key={s.id} className="hover:bg-cream/40 transition-colors">
                    <td className="px-4 py-3 font-medium text-navy">{s.name}</td>
                    <td className="px-4 py-3 text-navy/75">{s.city}</td>
                    <td className="px-4 py-3 font-semibold">{formatPrice(ca)}</td>
                    <td className="px-4 py-3 text-navy/75">{s.sponsored.length}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          s.active ? "bg-emerald-50 text-emerald-700" : "bg-cream text-navy/65"
                        }`}
                      >
                        {s.active ? "Actif" : "Inactif"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/consultants/${s.id}`}
                        className="text-xs font-semibold text-navy hover:underline"
                      >
                        Voir fiche →
                      </Link>
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
