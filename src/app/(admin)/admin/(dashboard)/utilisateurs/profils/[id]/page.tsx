import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/admin-page-guard";
import { prisma } from "@/lib/prisma";
import { normalizePermissions } from "@/lib/permissions";
import { AccessProfileForm } from "@/components/admin/AccessProfileForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Modifier un profil" };

export default async function EditProfilePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage("utilisateurs");
  const { id } = await params;
  const profile = await prisma.accessProfile.findUnique({ where: { id }, include: { users: { select: { id: true, name: true } } } });
  if (!profile) notFound();

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <Link href="/admin/utilisateurs/profils" className="text-xs text-navy/70 hover:underline">← Profils et privilèges</Link>
        <h1 className="mt-1 font-serif-display text-2xl font-semibold text-navy">{profile.name}</h1>
        <p className="mt-1 text-sm text-navy/75">
          {profile.users.length
            ? `Attribué à ${profile.users.length} utilisateur(s) : les changements s'appliquent à leur prochaine connexion.`
            : "Ce profil n'est attribué à personne pour l'instant."}
        </p>
      </div>
      <section className="rounded-2xl border border-line bg-white p-5">
        <AccessProfileForm id={profile.id} name={profile.name} description={profile.description ?? ""} permissions={normalizePermissions(profile.permissions)} />
      </section>
    </div>
  );
}
