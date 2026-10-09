import Link from "next/link";
import { getReseller } from "@/lib/reseller";
import { ProfileForm } from "@/components/admin/ProfileForm";
import { WalletForm } from "@/components/admin/WalletForm";
import { NotReseller } from "@/components/admin/NotReseller";
import { prisma } from "@/lib/prisma";
import { getProtocol } from "@/lib/protocol-store";

export const dynamic = "force-dynamic";

export default async function MonProfilPage() {
  const me = await getReseller();
  if (!me) return <NotReseller />;
  const [doc, signed] = await Promise.all([getProtocol(), prisma.protocolSignature.findFirst({ where: { consultantId: me.id }, orderBy: { signedAt: "desc" }, select: { version: true } })]);
  const upToDate = signed?.version === doc.version;
  return (
    <div className="max-w-2xl">
      <h1 className="font-serif-display text-2xl font-semibold text-navy">Mon profil</h1>
      <p className="mt-1 text-sm text-navy/75">Ces informations sont visibles par vos clients (liste des consultants, votre page personnelle).</p>

      <Link href="/admin/mon-protocole" className={`mt-5 block rounded-2xl border px-5 py-4 text-sm ${upToDate ? "border-line bg-white text-navy/80 hover:border-navy" : "border-amber-300 bg-amber-50 text-amber-950 hover:border-amber-500"}`}>
        <span className="font-semibold">Protocole de partenariat</span> · {upToDate ? `version ${doc.version} signée : télécharger mon exemplaire` : signed ? `nouvelle version ${doc.version} à signer` : "à lire et signer"} →
      </Link>

      <div className="mt-6 rounded-2xl border border-line bg-white p-5 sm:p-6">
        <ProfileForm name={me.name} city={me.city} whatsapp={me.whatsapp} />
      </div>

      <div id="wallet" className="mt-6 rounded-2xl border border-line bg-white p-5 sm:p-6">
        <h2 className="font-serif-display text-lg font-semibold text-navy">Mon wallet de commissions</h2>
        <p className="mt-1 text-sm text-navy/75">Vos commissions vous sont versées automatiquement sur ce compte Wave ou Orange Money. Il n&apos;est visible que par vous et l&apos;équipe JAMAAL.</p>
        <div className="mt-4"><WalletForm provider={me.walletProvider ?? null} number={me.walletNumber ?? null} holder={me.walletHolderName ?? null} /></div>
      </div>

      <div className="mt-6 rounded-2xl border border-line bg-white p-5 text-sm">
        <h2 className="font-serif-display text-lg font-semibold text-navy">Mon compte</h2>
        <dl className="mt-3 grid gap-2 sm:grid-cols-[10rem_1fr]">
          <dt className="text-navy/70">Identifiant de lien</dt>
          <dd className="font-mono text-navy">{me.slug ?? "— (à demander à l'équipe JAMAAL)"}</dd>
          <dt className="text-navy/70">Mon parrain</dt>
          <dd className="text-navy">{me.sponsor ? `${me.sponsor.name} (${me.sponsor.city})` : "Aucun"}</dd>
          <dt className="text-navy/70">Statut</dt>
          <dd className="text-navy">{me.active ? "Actif" : "Inactif"}</dd>
          <dt className="text-navy/70">Membre depuis</dt>
          <dd className="text-navy">{me.createdAt.toLocaleDateString("fr-FR")}</dd>
        </dl>
        <p className="mt-4 text-xs text-navy/70">
          Pour changer votre mot de passe, utilisez <Link href="/admin/forgot-password" className="font-semibold text-rose-dark hover:underline">« Mot de passe oublié »</Link>.
        </p>
      </div>
    </div>
  );
}
