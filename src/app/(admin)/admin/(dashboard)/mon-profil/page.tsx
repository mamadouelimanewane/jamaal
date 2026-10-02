import Link from "next/link";
import { getReseller } from "@/lib/reseller";
import { ProfileForm } from "@/components/admin/ProfileForm";
import { NotReseller } from "@/components/admin/NotReseller";

export const dynamic = "force-dynamic";

export default async function MonProfilPage() {
  const me = await getReseller();
  if (!me) return <NotReseller />;
  return (
    <div className="max-w-2xl">
      <h1 className="font-serif-display text-2xl font-semibold text-navy">Mon profil</h1>
      <p className="mt-1 text-sm text-navy/60">Ces informations sont visibles par vos clients (liste des revendeurs, votre page personnelle).</p>

      <div className="mt-6 rounded-2xl border border-line bg-white p-5 sm:p-6">
        <ProfileForm name={me.name} city={me.city} whatsapp={me.whatsapp} />
      </div>

      <div className="mt-6 rounded-2xl border border-line bg-white p-5 text-sm">
        <h2 className="font-serif-display text-lg font-semibold text-navy">Mon compte</h2>
        <dl className="mt-3 grid gap-2 sm:grid-cols-[10rem_1fr]">
          <dt className="text-navy/50">Identifiant de lien</dt>
          <dd className="font-mono text-navy">{me.slug ?? "— (à demander à l'équipe JAMAAL)"}</dd>
          <dt className="text-navy/50">Mon parrain</dt>
          <dd className="text-navy">{me.sponsor ? `${me.sponsor.name} (${me.sponsor.city})` : "Aucun"}</dd>
          <dt className="text-navy/50">Statut</dt>
          <dd className="text-navy">{me.active ? "Actif" : "Inactif"}</dd>
          <dt className="text-navy/50">Membre depuis</dt>
          <dd className="text-navy">{me.createdAt.toLocaleDateString("fr-FR")}</dd>
        </dl>
        <p className="mt-4 text-xs text-navy/50">
          Pour changer votre mot de passe, utilisez <Link href="/admin/forgot-password" className="font-semibold text-rose-dark hover:underline">« Mot de passe oublié »</Link>.
        </p>
      </div>
    </div>
  );
}
