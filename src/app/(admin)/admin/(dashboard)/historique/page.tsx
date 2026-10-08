import { requireAdmin } from "@/lib/actions/auth-guard";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ActivityHistoryPage() {
  await requireAdmin();
  const entries = await prisma.activityLog.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  return <div className="max-w-5xl">
    <h1 className="font-serif-display text-2xl font-semibold text-navy">Journal des actions</h1>
    <p className="mt-1 text-sm text-navy/75">200 actions récentes enregistrées dans l’administration.</p>
    <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-white"><table className="w-full text-left text-sm">
      <thead className="bg-cream text-xs uppercase text-navy/70"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Utilisateur</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Objet</th><th className="px-4 py-3">Identifiant</th></tr></thead>
      <tbody>{entries.map((entry) => <tr key={entry.id} className="border-t border-line"><td className="whitespace-nowrap px-4 py-3 text-xs text-navy/75">{entry.createdAt.toLocaleString("fr-FR")}</td><td className="px-4 py-3">{entry.userName}</td><td className="px-4 py-3 font-medium text-navy">{entry.action}</td><td className="px-4 py-3 text-navy/85">{entry.entity}</td><td className="px-4 py-3 font-mono text-xs text-navy/70">{entry.entityId ?? "—"}</td></tr>)}</tbody>
    </table>{entries.length === 0 && <p className="p-5 text-sm text-navy/70">Aucune action enregistrée.</p>}</div>
  </div>;
}
