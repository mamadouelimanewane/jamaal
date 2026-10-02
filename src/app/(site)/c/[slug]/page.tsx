import { notFound } from "next/navigation";
import Link from "next/link";
import { resolveConsultantBySlug } from "@/lib/ref";

type Props = { params: Promise<{ slug: string }> };

/**
 * Page publique du consultant.
 * Pose le cookie jamaal_ref puis affiche une carte de visite digitale.
 * Exemple : /c/aminata
 */
export default async function ConsultantPublicPage({ params }: Props) {
  const { slug } = await params;
  const consultant = await resolveConsultantBySlug(slug);

  if (!consultant) notFound();

  // Le cookie d'attribution (30 jours) est posé par src/proxy.ts pour toute URL /c/<slug>.

  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <p className="text-xs font-semibold uppercase tracking-widest text-rose-dark">
        Consultant·e JAMAAL
      </p>
      <h1 className="mt-3 font-serif-display text-3xl font-semibold text-navy">
        {consultant.name}
      </h1>
      <p className="mt-2 text-sm text-navy/60">{consultant.city}</p>

      <p className="mt-6 text-sm leading-relaxed text-navy/80">
        Je suis votre interlocuteur·rice JAMAAL. En passant commande via mon lien,
        je pourrai vous accompagner personnellement (conseil, livraison, suivi).
      </p>

      <div className="mt-10 flex flex-col gap-3">
        <Link
          href="/"
          className="rounded-full bg-navy px-6 py-3 text-sm font-semibold text-white transition hover:bg-navy-light"
        >
          Découvrir les parfums →
        </Link>

        {consultant.whatsapp && (
          <a
            href={consultant.whatsapp.startsWith("http") ? consultant.whatsapp : `https://wa.me/${consultant.whatsapp.replace(/\D/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-line px-6 py-3 text-sm font-semibold text-navy transition hover:border-navy"
          >
            Me contacter sur WhatsApp
          </a>
        )}
      </div>

      <p className="mt-10 text-xs text-navy/40">
        Votre commande sera automatiquement rattachée à {consultant.name}.
      </p>
    </div>
  );
}
