import { cookies } from "next/headers";
import { INVITE_COOKIE, inviteCode } from "@/lib/invite-lock";
import { resolveSponsorCode } from "@/lib/sponsor-codes";
import Link from "next/link";
import type { Metadata } from "next";
import { ApplicationForm } from "@/components/ApplicationForm";
import { getProtocol } from "@/lib/protocol-store";

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

export default async function DevenirConsultantPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;
  // Code de l'invitation : dans l'adresse, ou mémorisé (cookie) si la personne revient sans le lien.
  const candidate = inviteCode(ref) || inviteCode((await cookies()).get(INVITE_COOKIE)?.value);
  // Verrouillé seulement si le parrain est encore actif : sinon la personne peut saisir un autre code.
  const sponsorCode = candidate && (await resolveSponsorCode(candidate)) ? candidate : "";

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

      <div className="mt-10 rounded-2xl border border-line bg-white p-5 sm:p-8">
        <ApplicationForm sponsorCode={sponsorCode} protocol={await getProtocol()} />
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
