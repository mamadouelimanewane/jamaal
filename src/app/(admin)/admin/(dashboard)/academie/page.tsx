import Link from "next/link";
import { CheckCircle2, Circle, PlayCircle } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BADGES, academyProgress, badgeLabel, passed } from "@/data/academy";
import { getReseller } from "@/lib/reseller";
import { consultantAcademy, getAcademyVideos } from "@/lib/academy-store";
import { VideosForm } from "@/components/academy/VideosForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Académie JAMAAL" };

export default async function AcademiePage() {
  const session = await auth();
  const me = await getReseller();
  const isAdmin = session?.user?.role === "ADMIN" && !me;
  const videos = await getAcademyVideos();

  if (isAdmin) {
    const [results, consultants] = await Promise.all([
      prisma.quizResult.findMany({ select: { consultantId: true, quizId: true, score: true, total: true, updatedAt: true } }),
      prisma.consultant.findMany({ where: { active: true }, select: { id: true, name: true, city: true, slug: true }, orderBy: { name: "asc" } }),
    ]);
    const rows = consultants
      .map((c) => ({ c, p: academyProgress(results.filter((r) => r.consultantId === c.id)) }))
      .sort((a, b) => b.p.filter((x) => x.earned).length - a.p.filter((x) => x.earned).length || b.p.reduce((s, x) => s + x.done, 0) - a.p.reduce((s, x) => s + x.done, 0));
    return (
      <div className="max-w-5xl space-y-8">
        <div>
          <h1 className="font-serif-display text-2xl font-semibold text-navy">Académie JAMAAL</h1>
          <p className="mt-1 text-sm text-navy/75">Modules courts (vidéo, leçon, quiz) qui mènent aux badges affichés sur la boutique de chaque revendeur.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {BADGES.map((b) => (
            <div key={b.id} className="rounded-2xl border border-line bg-white p-4">
              <p className="text-2xl">{b.emoji}</p>
              <p className="mt-1 font-semibold text-navy">{b.label.f}</p>
              <p className="text-xs text-navy/60">{b.modules.length} modules · {rows.filter((r) => r.p.find((x) => x.badge.id === b.id)?.earned).length} certifié(s)</p>
            </div>
          ))}
        </div>
        <section className="rounded-2xl border border-line bg-white p-5">
          <h2 className="font-serif-display text-lg font-semibold text-navy">Vidéos des modules</h2>
          <p className="mb-4 mt-1 text-sm text-navy/70">Facultatif : collez le lien d&apos;une vidéo YouTube (même non répertoriée), Vimeo ou d&apos;un fichier .mp4. Sans vidéo, le module montre la leçon écrite et le quiz.</p>
          <VideosForm videos={videos} modules={BADGES.flatMap((b) => b.modules.map((m) => ({ id: m.id, title: m.title, badge: b.label.f })))} />
        </section>
        <section className="rounded-2xl border border-line bg-white p-5">
          <h2 className="font-serif-display text-lg font-semibold text-navy">Progression des revendeurs</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-cream text-left text-xs uppercase text-navy/70"><tr><th className="px-3 py-2">Revendeur</th>{BADGES.map((b) => <th key={b.id} className="px-3 py-2">{b.emoji} {b.label.f}</th>)}</tr></thead>
              <tbody>
                {rows.map(({ c, p }) => (
                  <tr key={c.id} className="border-t border-line">
                    <td className="px-3 py-2"><p className="font-semibold text-navy">{c.name}</p><p className="text-xs text-navy/60">{c.city}</p></td>
                    {p.map((x) => <td key={x.badge.id} className="px-3 py-2">{x.earned ? <span className="font-semibold text-emerald-700">✅ certifié</span> : <span className="text-navy/60">{x.done} / {x.total}</span>}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    );
  }

  if (!me) return <p className="text-navy">Accès réservé aux revendeurs.</p>;
  const { results, progress } = await consultantAcademy(me.id);
  const byId = new Map(results.map((r) => [r.quizId, r]));
  const earned = progress.filter((p) => p.earned).length;
  return (
    <div className="max-w-3xl">
      <h1 className="font-serif-display text-2xl font-semibold text-navy">Académie JAMAAL</h1>
      <p className="mt-1 text-sm text-navy/75">Des modules de 3 à 4 minutes : une vidéo ou une leçon, puis un quiz. Chaque badge obtenu s&apos;affiche sur votre boutique personnelle et rassure vos clients.</p>
      <p className="mt-3 inline-block rounded-full bg-navy px-4 py-1.5 text-sm font-semibold text-white">🏅 {earned} / {BADGES.length} badge{earned > 1 ? "s" : ""} obtenu{earned > 1 ? "s" : ""}</p>

      <div className="mt-6 space-y-5">
        {progress.map(({ badge: b, done, total, earned: ok, earnedAt }) => (
          <section key={b.id} className={`rounded-3xl border bg-white p-5 ${ok ? "border-emerald-300" : "border-line"}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-3xl">{b.emoji}</p>
                <h2 className="mt-1 font-serif-display text-xl font-semibold text-navy">{badgeLabel(b, me.titleForm)}</h2>
                <p className="mt-1 text-sm text-navy/70">{b.promise}</p>
              </div>
              {ok ? <span className="shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">Obtenu{earnedAt ? ` le ${earnedAt.toLocaleDateString("fr-FR")}` : ""}</span> : <span className="shrink-0 rounded-full bg-cream px-3 py-1 text-xs font-semibold text-navy">{done} / {total}</span>}
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full" style={{ width: `${(done / total) * 100}%`, background: b.color }} /></div>
            <ul className="mt-4 divide-y divide-line">
              {b.modules.map((m) => {
                const r = byId.get(m.id);
                const ok2 = passed(r);
                return (
                  <li key={m.id}>
                    <Link href={`/admin/academie/${m.id}`} className="flex items-center gap-3 py-3 hover:bg-cream/50">
                      {ok2 ? <CheckCircle2 size={20} className="shrink-0 text-emerald-600" /> : <Circle size={20} className="shrink-0 text-navy/30" />}
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-navy">{m.title}</span>
                        <span className="block text-xs text-navy/60">{m.minutes} min{videos[m.id] ? " · vidéo" : ""}{r ? ` · meilleur score ${r.score}/${r.total}` : ""}</span>
                      </span>
                      <span className="inline-flex items-center gap-1 text-sm font-semibold text-rose-dark"><PlayCircle size={16} /> {ok2 ? "Revoir" : r ? "Réessayer" : "Commencer"}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            {ok && <Link href={`/admin/academie/certificat/${b.id}`} className="mt-3 inline-block rounded-full border border-line px-4 py-2 text-sm font-semibold text-navy hover:bg-cream">Mon certificat ↗</Link>}
          </section>
        ))}
      </div>
    </div>
  );
}
