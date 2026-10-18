import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-page-guard";
import { prisma } from "@/lib/prisma";
import { createProfileFromTemplate, deleteProfile } from "@/lib/actions/profiles";
import { PROFILE_TEMPLATES, normalizePermissions, summarizePermissions } from "@/lib/permissions";
import { AccessProfileForm } from "@/components/admin/AccessProfileForm";
import { ConfirmSubmit } from "@/components/admin/ConfirmSubmit";

export const dynamic = "force-dynamic";
export const metadata = { title: "Profils et privilèges" };

export default async function ProfilesPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  await requireAdminPage("utilisateurs");
  const { ok } = await searchParams;
  const profiles = await prisma.accessProfile.findMany({ orderBy: { name: "asc" }, include: { users: { select: { id: true, name: true, active: true } } } });
  const existing = new Set(profiles.map((p) => p.name.toLowerCase()));
  const templates = PROFILE_TEMPLATES.map((t, i) => ({ ...t, i })).filter((t) => !existing.has(t.name.toLowerCase()));

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <Link href="/admin/utilisateurs" className="text-xs text-navy/70 hover:underline">← Utilisateurs</Link>
        <h1 className="mt-1 font-serif-display text-2xl font-semibold text-navy">Profils et privilèges</h1>
        <p className="mt-1 max-w-3xl text-sm text-navy/75">
          Un profil définit, module par module, ce qu&apos;un administrateur peut voir (lecture) et modifier (écriture). Un administrateur sans profil a l&apos;accès complet. Pour limiter quelqu&apos;un, créez un profil puis attribuez-le dans la fiche de l&apos;utilisateur.
        </p>
      </div>

      {ok && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-800">{ok}</p>}

      <section>
        <h2 className="mb-2 font-semibold text-navy">Profils existants ({profiles.length})</h2>
        {profiles.length === 0 ? (
          <p className="rounded-2xl border border-line bg-white p-5 text-sm text-navy/70">Aucun profil pour l&apos;instant : tous les administrateurs ont l&apos;accès complet.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {profiles.map((p) => (
              <li key={p.id} className="rounded-2xl border border-line bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-navy">{p.name}</p>
                    {p.description && <p className="text-xs text-navy/65">{p.description}</p>}
                  </div>
                  <span className="shrink-0 rounded-full bg-cream px-2 py-0.5 text-xs font-semibold text-navy">{p.users.length} utilisateur{p.users.length > 1 ? "s" : ""}</span>
                </div>
                <p className="mt-2 text-xs text-navy/80">{summarizePermissions(normalizePermissions(p.permissions))}</p>
                {p.users.length > 0 && (
                  <p className="mt-2 text-xs text-navy/65">
                    {p.users.map((u, i) => (
                      <span key={u.id}>{i ? ", " : ""}<Link href={`/admin/utilisateurs/${u.id}`} className="underline">{u.name}</Link>{u.active ? "" : " (suspendu)"}</span>
                    ))}
                  </p>
                )}
                <div className="mt-3 flex items-center gap-3">
                  <Link href={`/admin/utilisateurs/profils/${p.id}`} className="rounded-full bg-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-light">Modifier</Link>
                  <form action={deleteProfile.bind(null, p.id)}>
                    <ConfirmSubmit message={`Supprimer le profil « ${p.name} » ?`} className="text-xs font-semibold text-rose-dark hover:underline">Supprimer</ConfirmSubmit>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {templates.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold text-navy">Créer en un clic depuis un modèle</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {templates.map((t) => (
              <li key={t.name} className="flex items-start justify-between gap-3 rounded-2xl border border-dashed border-line bg-white p-4">
                <div>
                  <p className="font-semibold text-navy">{t.name}</p>
                  <p className="text-xs text-navy/65">{t.description}</p>
                  <p className="mt-1 text-xs text-navy/80">{summarizePermissions(t.permissions)}</p>
                </div>
                <form action={createProfileFromTemplate.bind(null, t.i)}>
                  <button className="shrink-0 rounded-full border border-navy px-3 py-1.5 text-xs font-semibold text-navy hover:bg-navy hover:text-white">Créer</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="mb-3 font-semibold text-navy">Nouveau profil personnalisé</h2>
        <AccessProfileForm />
      </section>
    </div>
  );
}
