import { cookies } from "next/headers";
import { INVITE_COOKIE, inviteCode } from "@/lib/invite-lock";
import { resolveSponsorCode } from "@/lib/sponsor-codes";
import Link from "next/link";
import type { Metadata } from "next";
import { ApplicationForm } from "@/components/ApplicationForm";
import { getProtocol } from "@/lib/protocol-store";
import { prisma } from "@/lib/prisma";
import { getBusinessModel } from "@/lib/business-model-store";
import { simRates } from "@/lib/earnings-sim";
import { EarningsSimulator } from "@/components/EarningsSimulator";

/** Panier moyen réel des 90 derniers jours (produits, hors livraison), arrondi ; 20 000 F à défaut. */
async function averageBasket(): Promise<number> {
  const since = new Date(Date.now() - 90 * 86_400_000);
  const agg = await prisma.order
    .aggregate({ where: { createdAt: { gte: since }, status: { not: "ANNULEE" }, isReservation: false }, _avg: { total: true, deliveryFee: true }, _count: { _all: true } })
    .catch(() => null);
  const avg = agg && agg._count._all >= 10 ? (agg._avg.total ?? 0) - (agg._avg.deliveryFee ?? 0) : 0;
  return avg > 0 ? Math.min(40_000, Math.max(8_000, Math.round(avg / 1_000) * 1_000)) : 20_000;
}

export const metadata: Metadata = {
  title: "Devenir consultant·e JAMAAL",
  description:
    "Rejoignez le réseau JAMAAL, revendeur officiel de la marque CHOGAN (Italie) : parfums, beauté, bien-être et maison, avec votre propre vitrine en ligne.",
};

const perks = [
  ["Toute la gamme Chogan", "Parfums, beauté, nutrition, entretien de la maison : un catalogue complet à proposer."],
  ["Votre vitrine personnelle", "Un lien /c/votre-nom qui attribue automatiquement vos ventes."],
  ["Commissions & parrainage", "Gagnez sur vos ventes et sur celles de votre équipe."],
  ["Formation & outils", "Scripts WhatsApp, kit marketing et accompagnement de l'équipe JAMAAL."],
];

export const dynamic = "force-dynamic";

export default async function DevenirConsultantPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;
  // Code de l'invitation : dans l'adresse, ou mémorisé (cookie) si la personne revient sans le lien.
  const candidate = inviteCode(ref) || inviteCode((await cookies()).get(INVITE_COOKIE)?.value);
  // Verrouillé seulement si le parrain est encore actif : sinon la personne peut saisir un autre code.
  const sponsor = candidate ? await resolveSponsorCode(candidate) : null;
  const sponsorCode = sponsor ? candidate : "";
  const [protocol, model, basket] = await Promise.all([getProtocol(), getBusinessModel(), averageBasket()]);
  const rates = simRates(model);

  // Lien d'invitation : formulaire seul, sans présentation ni champs facultatifs.
  if (sponsor) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <p className="luxury-eyebrow">Invitation</p>
        <h1 className="mt-2 font-serif-display text-3xl font-semibold text-navy">Rejoignez l&apos;équipe de {sponsor.name.split(/\s+/)[0]}</h1>
        <p className="mt-2 text-sm text-navy/70">Remplissez le formulaire en 3 étapes : environ 3 minutes.</p>
        <details className="mt-5 rounded-2xl border border-line bg-cream/60 p-4">
          <summary className="cursor-pointer font-semibold text-navy">💰 Combien je peux gagner ?</summary>
          <div className="mt-4"><EarningsSimulator rates={rates} defaultBasket={basket} /></div>
        </details>
        <div id="candidature" className="mt-6 scroll-mt-24 rounded-2xl border border-line bg-white p-5 sm:p-8">
          <ApplicationForm sponsorCode={sponsorCode} sponsorName={sponsor.name} protocol={protocol} />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <p className="luxury-eyebrow">Rejoindre le réseau</p>
      <h1 className="mt-2 font-serif-display text-3xl font-semibold text-navy sm:text-4xl">
        Devenir consultant·e JAMAAL
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-navy/70">
        JAMAAL est le revendeur officiel de la marque CHOGAN (Italie). Rejoignez notre réseau de
        consultant·es indépendant·es et proposez toute la gamme à votre entourage. Remplissez le
        formulaire : l&apos;équipe étudie chaque candidature et vous répond rapidement.
      </p>

      <ul className="mt-8 grid gap-3 sm:grid-cols-2">
        {perks.map(([title, text]) => (
          <li key={title} className="rounded-2xl border border-line bg-cream p-4">
            <p className="text-sm font-semibold text-navy">{title}</p>
            <p className="mt-1 text-xs leading-relaxed text-navy/65">{text}</p>
          </li>
        ))}
      </ul>

      <section className="mt-12">
        <p className="luxury-eyebrow">Simulateur</p>
        <h2 className="mt-1 font-serif-display text-2xl font-semibold text-navy sm:text-3xl">Combien je peux gagner ?</h2>
        <p className="mb-5 mt-2 text-sm text-navy/70">Réglez votre rythme de ventes et la taille de votre équipe : vos gains sont calculés avec le vrai barème JAMAAL.</p>
        <EarningsSimulator rates={rates} defaultBasket={basket} />
      </section>

      <div id="candidature" className="mt-12 scroll-mt-24 rounded-2xl border border-line bg-white p-5 sm:p-8">
        <h2 className="mb-5 font-serif-display text-2xl font-semibold text-navy">Ma candidature</h2>
        <ApplicationForm sponsorCode="" protocol={protocol} />
      </div>

      <p className="mt-6 text-center text-sm text-navy/60">
        Déjà consultant·e ?{" "}
        <Link href="/espace-revendeur" className="font-semibold text-rose-dark hover:underline">
          Accéder à mon espace
        </Link>
      </p>
    </div>
  );
}
