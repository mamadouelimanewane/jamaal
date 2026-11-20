import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { KINDS } from "@/lib/reseller-outreach";
import { requireAdmin } from "@/lib/actions/auth-guard";
import { AnnouncementForm } from "@/components/admin/AnnouncementForm";
import { AnnouncementRowActions } from "@/components/admin/AnnouncementRowActions";

export const dynamic = "force-dynamic";

export default async function AnnoncesPage() {
  await requireAdmin("marketing", "read");
  const announcements = await prisma.announcement.findMany({ orderBy: [{ pinned: "desc" }, { createdAt: "desc" }], take: 100 });
  const targetIds = [...new Set(announcements.flatMap((a) => a.consultantIds))];
  const names = new Map((targetIds.length ? await prisma.consultant.findMany({ where: { id: { in: targetIds } }, select: { id: true, name: true } }) : []).map((c) => [c.id, c.name]));

  return (
    <div className="max-w-3xl">
      <h1 className="font-serif-display text-2xl font-semibold text-navy">Annonces aux consultants</h1>
      <p className="mt-1 text-sm text-navy/75">Communiquez avec tout le réseau : nouveautés, promotions, rappels. Chaque annonce apparaît dans « Ma communication » de chaque consultant et déclenche une notification.</p>
      <p className="mt-2 rounded-xl bg-cream/70 px-4 py-2.5 text-sm text-navy/85">Pour écrire seulement à certains revendeurs selon leurs résultats (inactifs, sans vente, meilleurs…), passez par <Link href="/admin/boutiques-stats" className="font-semibold underline">Statistiques des boutiques</Link> : cochez-les, puis « Envoyer un message » avec un texte personnalisé.</p>

      <div className="mt-6 rounded-2xl border border-line bg-white p-5 sm:p-6">
        <AnnouncementForm />
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {announcements.map((a) => (
          <article key={a.id} className="rounded-2xl border border-line bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-navy">{a.title} {a.pinned && <span className="ml-2 rounded-full bg-rose/20 px-2 py-0.5 text-xs font-semibold text-rose-dark">Épinglée</span>}</h2>
                <p className="text-xs text-navy/65">
                  {a.createdAt.toLocaleString("fr-FR")} ·{" "}
                  {a.consultantIds.length ? (
                    <span title={a.consultantIds.map((id) => names.get(id) ?? "?").join(", ")} className="font-semibold text-navy">
                      {a.kind && a.kind in KINDS ? `${KINDS[a.kind as keyof typeof KINDS]} · ` : ""}{a.consultantIds.length} revendeur(s) ciblé(s){a.statsDays ? ` (stats ${a.statsDays} j)` : ""} : {a.consultantIds.slice(0, 4).map((id) => names.get(id) ?? "?").join(", ")}{a.consultantIds.length > 4 ? "…" : ""}
                    </span>
                  ) : (
                    "Tout le réseau"
                  )}
                </p>
              </div>
              <AnnouncementRowActions id={a.id} pinned={a.pinned} />
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-navy/85">{a.body}</p>
          </article>
        ))}
        {announcements.length === 0 && <p className="rounded-2xl border border-line bg-white p-10 text-center text-navy/70">Aucune annonce publiée.</p>}
      </div>
    </div>
  );
}
