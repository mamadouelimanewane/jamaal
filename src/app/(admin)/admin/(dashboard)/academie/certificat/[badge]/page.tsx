import { notFound } from "next/navigation";
import { BADGES, badgeLabel } from "@/data/academy";
import { getReseller } from "@/lib/reseller";
import { consultantAcademy } from "@/lib/academy-store";
import { PrintButton } from "@/components/academy/PrintButton";

export const dynamic = "force-dynamic";

/** Certificat imprimable (ou à enregistrer en PDF) d'un badge obtenu. */
export default async function CertificatPage({ params }: { params: Promise<{ badge: string }> }) {
  const { badge: id } = await params;
  const badge = BADGES.find((b) => b.id === id);
  const me = await getReseller();
  if (!badge || !me) notFound();
  const p = (await consultantAcademy(me.id)).progress.find((x) => x.badge.id === id);
  if (!p?.earned) notFound();
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex justify-end print:hidden"><PrintButton /></div>
      {/* À l'impression : seul le certificat (pas le menu de l'espace). */}
      <style>{`@media print { body * { visibility: hidden; } #certificat, #certificat * { visibility: visible; } #certificat { position: absolute; inset: 0; margin: 0; } }`}</style>
      <div id="certificat" className="rounded-[2rem] border-[10px] bg-white p-10 text-center shadow-xl print:shadow-none" style={{ borderColor: badge.color }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- logo du site */}
        <img src="/logo/jamaal-logo.jpg" alt="JAMAAL" className="mx-auto h-20 w-auto" />
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.3em] text-navy/60">Académie JAMAAL · Certificat</p>
        <p className="mt-6 text-sm text-navy/70">Décerné à</p>
        <p className="mt-1 font-serif-display text-4xl font-semibold text-navy">{me.name}</p>
        <p className="mt-6 text-5xl">{badge.emoji}</p>
        <p className="mt-2 font-serif-display text-3xl" style={{ color: badge.color }}>{badgeLabel(badge, me.titleForm)}</p>
        <p className="mx-auto mt-4 max-w-md text-sm text-navy/75">A suivi et validé les modules : {badge.modules.map((m) => m.title).join(", ")}.</p>
        <p className="mt-8 text-sm text-navy/60">Le {p.earnedAt?.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })} · {me.city}</p>
      </div>
    </div>
  );
}
