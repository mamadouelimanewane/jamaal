import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/actions/auth-guard";
import { AnnouncementForm } from "@/components/admin/AnnouncementForm";
import { AnnouncementRowActions } from "@/components/admin/AnnouncementRowActions";

export const dynamic = "force-dynamic";

export default async function AnnoncesPage() {
  await requireAdmin();
  const announcements = await prisma.announcement.findMany({ orderBy: [{ pinned: "desc" }, { createdAt: "desc" }], take: 100 });

  return (
    <div className="max-w-3xl">
      <h1 className="font-serif-display text-2xl font-semibold text-navy">Annonces aux consultants</h1>
      <p className="mt-1 text-sm text-navy/75">Communiquez avec tout le réseau : nouveautés, promotions, rappels. Chaque annonce apparaît dans « Ma communication » de chaque consultant et déclenche une notification.</p>

      <div className="mt-6 rounded-2xl border border-line bg-white p-5 sm:p-6">
        <AnnouncementForm />
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {announcements.map((a) => (
          <article key={a.id} className="rounded-2xl border border-line bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-navy">{a.title} {a.pinned && <span className="ml-2 rounded-full bg-rose/20 px-2 py-0.5 text-xs font-semibold text-rose-dark">Épinglée</span>}</h2>
                <p className="text-xs text-navy/65">{a.createdAt.toLocaleString("fr-FR")}</p>
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
