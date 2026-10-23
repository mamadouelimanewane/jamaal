import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock } from "lucide-react";
import { BADGES, moduleById, passed, videoEmbed } from "@/data/academy";
import { getReseller } from "@/lib/reseller";
import { consultantAcademy, getAcademyVideos } from "@/lib/academy-store";
import { ModuleQuiz } from "@/components/academy/ModuleQuiz";
import { NotReseller } from "@/components/admin/NotReseller";

export const dynamic = "force-dynamic";

/** Un module de l'Académie : vidéo (si réglée), points clés, puis quiz. */
export default async function AcademyModulePage({ params }: { params: Promise<{ module: string }> }) {
  const { module: id } = await params;
  const mod = moduleById(id);
  if (!mod) notFound();
  const me = await getReseller();
  if (!me) return <NotReseller />;
  const [videos, { results }] = await Promise.all([getAcademyVideos(), consultantAcademy(me.id)]);
  const badge = BADGES.find((b) => b.modules.some((m) => m.id === id))!;
  const best = results.find((r) => r.quizId === id) ?? null;
  const video = videoEmbed(videos[id]);
  return (
    <div className="max-w-2xl">
      <Link href="/admin/academie" className="text-sm font-semibold text-rose-dark">← Académie</Link>
      <p className="mt-3 text-xs font-semibold uppercase tracking-wider" style={{ color: badge.color }}>{badge.emoji} Badge {badge.label.f}</p>
      <h1 className="mt-1 font-serif-display text-2xl font-semibold text-navy">{mod.title}</h1>
      <p className="mt-1 flex items-center gap-3 text-sm text-navy/65">
        <span className="inline-flex items-center gap-1"><Clock size={14} /> {mod.minutes} min</span>
        {passed(best) && <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 size={14} /> Validé ({best!.score}/{best!.total})</span>}
      </p>

      {video && (
        <div className="mt-5 overflow-hidden rounded-2xl bg-black shadow-lg">
          {video.kind === "iframe" ? (
            <iframe src={video.src} title={mod.title} className="aspect-video w-full" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen loading="lazy" />
          ) : (
            <video src={video.src} controls playsInline className="aspect-video w-full" />
          )}
        </div>
      )}

      <section className="mt-5 rounded-2xl border border-line bg-white p-5">
        <h2 className="font-semibold text-navy">À retenir</h2>
        <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-navy/85">
          {mod.lesson.map((l) => <li key={l} className="flex gap-2"><span className="mt-0.5 text-rose-dark">•</span><span>{l}</span></li>)}
        </ul>
      </section>

      <section className="mt-5 rounded-2xl border border-ia/30 bg-white p-5">
        <h2 className="mb-3 font-semibold text-navy">Quiz · {mod.questions.length} questions <span className="font-normal text-navy/60">(80 % pour valider)</span></h2>
        <ModuleQuiz moduleId={mod.id} questions={mod.questions} best={best ? { score: best.score, total: best.total } : null} />
      </section>
    </div>
  );
}
