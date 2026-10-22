import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/admin-page-guard";
import { prisma } from "@/lib/prisma";
import { attachUser } from "@/lib/actions/users";
import { deleteUserAccount, setUserActive, setUserPassword, setUserRole, updateUserIdentity } from "@/lib/actions/user-admin";
import { ROLE_LABEL, isRoleName, ROLES } from "@/lib/user-rules";
import { summarizePermissions, normalizePermissions } from "@/lib/permissions";
import { ConfirmSubmit } from "@/components/admin/ConfirmSubmit";
import { AccessLinkButton } from "@/components/admin/AccessLinkButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Utilisateur" };

const inputClass = "mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-navy";
const labelClass = "text-xs font-medium text-navy/85";
const card = "rounded-2xl border border-line bg-white p-5";
const btn = "rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light";

const when = (d: Date | null) => (d ? d.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "jamais");

export default async function UserDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string }> }) {
  const session = await requireAdminPage("utilisateurs");
  const { id } = await params;
  const { ok } = await searchParams;

  const [user, profiles, logs, consultants, livreurs] = await Promise.all([
    prisma.user.findUnique({ where: { id }, include: { consultant: { select: { id: true, name: true, whatsapp: true } }, livreur: { select: { id: true, name: true, phone: true } }, customer: { select: { id: true, name: true } }, profile: { select: { id: true, name: true, permissions: true } } } }),
    prisma.accessProfile.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.activityLog.findMany({ where: { OR: [{ userId: id }, { entity: "User", entityId: id }] }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.consultant.findMany({ where: { user: null }, orderBy: { name: "asc" } }),
    prisma.livreur.findMany({ where: { user: null }, orderBy: { name: "asc" } }),
  ]);
  if (!user) notFound();
  const self = user.id === session.user?.id;
  const unattached = (user.role === "CONSULTANT" && !user.consultantId) || (user.role === "LIVREUR" && !user.livreurId);

  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <Link href="/admin/utilisateurs" className="text-xs text-navy/70 hover:underline">← Utilisateurs</Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="font-serif-display text-2xl font-semibold text-navy">{user.name}</h1>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${user.active ? "bg-emerald-50 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>{user.active ? "Actif" : "Suspendu"}</span>
          {self && <span className="rounded-full bg-navy/10 px-2.5 py-0.5 text-xs font-semibold text-navy">C&apos;est vous</span>}
        </div>
        <p className="mt-1 text-sm text-navy/70">
          {isRoleName(user.role) ? ROLE_LABEL[user.role] : user.role}
          {user.role === "ADMIN" && ` · ${user.profile ? `profil « ${user.profile.name} »` : "accès complet"}`} · créé le {user.createdAt.toLocaleDateString("fr-FR")} · dernière connexion : {when(user.lastLoginAt)}
        </p>
      </div>

      {ok && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-800">{ok}</p>}

      <section className={card}>
        <h2 className="mb-3 font-semibold text-navy">Identité et connexion</h2>
        <form action={updateUserIdentity.bind(null, user.id)} className="grid gap-3 sm:grid-cols-3">
          <label className={labelClass}>Nom<input name="name" defaultValue={user.name} required className={inputClass} /></label>
          <label className={labelClass}>E-mail<input type="email" name="email" defaultValue={user.email ?? ""} className={inputClass} /></label>
          <label className={labelClass}>Téléphone<input name="phone" defaultValue={user.phone ?? ""} inputMode="tel" className={inputClass} /></label>
          <p className="text-xs text-navy/60 sm:col-span-3">L&apos;e-mail ou le téléphone sert d&apos;identifiant de connexion : l&apos;un des deux est obligatoire.</p>
          <div className="sm:col-span-3"><button className={btn}>Enregistrer</button></div>
        </form>
      </section>

      <section className={card}>
        <h2 className="mb-1 font-semibold text-navy">Rôle et privilèges</h2>
        {self ? (
          <p className="text-sm text-navy/75">Vous ne pouvez pas modifier votre propre rôle ni vos propres privilèges : demandez à un autre administrateur.</p>
        ) : (
          <form action={setUserRole.bind(null, user.id)} className="grid gap-3 sm:grid-cols-3">
            <label className={labelClass}>
              Rôle
              <select name="role" defaultValue={user.role} className={inputClass}>
                {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
            </label>
            <label className={labelClass}>
              Privilèges (administrateur)
              <select name="profileId" defaultValue={user.profileId ?? "__full__"} className={inputClass}>
                <option value="__full__">Accès complet</option>
                {profiles.map((p) => <option key={p.id} value={p.id}>Profil : {p.name}</option>)}
              </select>
            </label>
            <div className="flex items-end"><button className={btn}>Enregistrer</button></div>
            <p className="text-xs text-navy/60 sm:col-span-3">
              Le profil ne s&apos;applique qu&apos;aux administrateurs. Consultant et Livreur exigent une fiche rattachée. Les changements s&apos;appliquent à la prochaine connexion de la personne. <Link href="/admin/utilisateurs/profils" className="underline">Gérer les profils</Link>
            </p>
          </form>
        )}
        {user.role === "ADMIN" && user.profile && <p className="mt-3 rounded-xl bg-sky-50 px-3 py-2 text-xs text-sky-900">Profil « {user.profile.name} » : {summarizePermissions(normalizePermissions(user.profile.permissions))}.</p>}
        {user.role === "ADMIN" && !user.profile && <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-900">Administrateur complet : accès à tous les modules, aux comptes et aux diagnostics.</p>}
      </section>

      {unattached && (
        <section className={`${card} border-amber-300 bg-amber-50/60`}>
          <h2 className="mb-1 font-semibold text-amber-900">Non rattaché à une fiche</h2>
          <p className="mb-3 text-sm text-amber-900/90">Son espace est vide tant qu&apos;aucune fiche {user.role === "LIVREUR" ? "livreur" : "revendeur"} n&apos;est rattachée.</p>
          <form action={attachUser.bind(null, user.id)} className="flex flex-wrap items-center gap-2">
            <select name={user.role === "LIVREUR" ? "livreurId" : "consultantId"} defaultValue="__new__" aria-label="Fiche à rattacher" className="rounded-lg border border-line px-2 py-1.5 text-sm">
              <option value="__new__">Créer sa fiche {user.role === "LIVREUR" ? "livreur" : "revendeur"}</option>
              {(user.role === "LIVREUR" ? livreurs.map((l) => ({ id: l.id, label: l.name })) : consultants.map((c) => ({ id: c.id, label: `${c.name} (${c.city})` }))).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
            <button className={btn}>Rattacher</button>
          </form>
        </section>
      )}

      <section className={card}>
        <h2 className="mb-3 font-semibold text-navy">Accès et mot de passe</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <form action={setUserPassword.bind(null, user.id)}>
            <label className={labelClass}>
              Nouveau mot de passe
              <input type="password" name="password" required minLength={8} placeholder="8 caractères, une lettre et un chiffre" className={inputClass} />
            </label>
            <button className={`${btn} mt-2`}>Changer le mot de passe</button>
          </form>
          <div>
            <p className={labelClass}>Ou laisser la personne choisir</p>
            <div className="mt-1"><AccessLinkButton userId={user.id} phone={user.phone ?? user.consultant?.whatsapp ?? user.livreur?.phone} name={user.name} /></div>
          </div>
        </div>
      </section>

      <section className={card}>
        <h2 className="mb-3 font-semibold text-navy">Statut du compte</h2>
        {user.active ? (
          self ? (
            <p className="text-sm text-navy/75">Vous ne pouvez pas suspendre votre propre compte.</p>
          ) : (
            <form action={setUserActive.bind(null, user.id, false)} className="flex flex-wrap items-center gap-3">
              <ConfirmSubmit message={`Suspendre le compte de ${user.name} ? La personne sera déconnectée et ne pourra plus se connecter.`} className="rounded-full border border-amber-400 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100">Suspendre le compte</ConfirmSubmit>
              <span className="text-xs text-navy/65">Réversible : les données et la fiche sont conservées.</span>
            </form>
          )
        ) : (
          <form action={setUserActive.bind(null, user.id, true)}><button className={btn}>Réactiver le compte</button></form>
        )}
      </section>

      <section className={card}>
        <h2 className="mb-3 font-semibold text-navy">Activité récente</h2>
        {logs.length === 0 ? (
          <p className="text-sm text-navy/65">Aucune activité enregistrée.</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {logs.map((l) => (
              <li key={l.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span className="text-navy">{l.action}{l.userId !== user.id && <span className="text-navy/55"> (par {l.userName})</span>}</span>
                <span className="text-xs text-navy/60">{when(l.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs"><Link href="/admin/historique" className="font-semibold text-navy underline">Voir tout le journal des actions</Link></p>
      </section>

      {!self && (
        <section className={`${card} border-rose-dark/30`}>
          <h2 className="mb-2 font-semibold text-rose-dark">Supprimer le compte</h2>
          <p className="mb-3 text-sm text-navy/75">Définitif : la personne ne pourra plus se connecter. La fiche revendeur ou livreur et l&apos;historique des commandes sont conservés. Pour une absence temporaire, préférez la suspension.</p>
          <form action={deleteUserAccount.bind(null, user.id)}>
            <ConfirmSubmit message={`Supprimer définitivement le compte de ${user.name} ?`} className="rounded-full border border-rose-dark px-4 py-2 text-sm font-semibold text-rose-dark hover:bg-rose/10">Supprimer le compte</ConfirmSubmit>
          </form>
        </section>
      )}
    </div>
  );
}
