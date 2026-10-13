import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ChangePasswordForm } from "@/components/admin/ChangePasswordForm";

export const dynamic = "force-dynamic";

/** Lien WhatsApp ouvert il y a moins de 30 min (fonction de module : hors rendu React). */
const recentLink = (at: number | null | undefined) => !!at && Date.now() - at < 30 * 60_000;

/**
 * Arrivée après un lien de connexion WhatsApp : l'espace est ouvert (30 jours). La personne peut,
 * si elle le souhaite, choisir tout de suite un mot de passe pour ses prochaines connexions.
 */
export default async function MotDePassePage({ searchParams }: { searchParams: Promise<{ lien?: string }> }) {
  const session = await auth();
  if (!session) redirect("/admin/login");
  const { lien } = await searchParams;
  const viaLink = recentLink(session.user.magicAt);
  const home = session.user.role === "LIVREUR" ? "/admin/mes-livraisons" : "/admin";
  return (
    <div className="max-w-xl">
      <h1 className="font-serif-display text-2xl font-semibold text-navy">{lien ? "Votre espace est ouvert ✅" : "Mon mot de passe"}</h1>
      {lien && <p className="mt-2 text-sm text-navy/75">Vous restez connecté sur ce téléphone pendant 30 jours. Pour vos prochaines connexions, choisissez un mot de passe (facultatif) : vous vous connecterez ensuite avec votre numéro WhatsApp et ce mot de passe.</p>}
      <div className="mt-6 rounded-2xl border border-line bg-white p-5 sm:p-6">
        <ChangePasswordForm viaLink={viaLink} />
      </div>
      <Link href={home} className="mt-5 inline-block rounded-full border border-navy/20 px-5 py-2.5 text-sm font-semibold text-navy hover:bg-cream">{lien ? "Plus tard : aller à mon espace" : "Retour à mon espace"}</Link>
    </div>
  );
}
