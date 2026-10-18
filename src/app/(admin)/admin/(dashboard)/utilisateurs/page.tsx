import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requireAdminPage } from "@/lib/admin-page-guard";
import { prisma } from "@/lib/prisma";
import { createUser } from "@/lib/actions/users";
import { ROLE_LABEL, isRoleName } from "@/lib/user-rules";

export const dynamic = "force-dynamic";
export const metadata = { title: "Utilisateurs" };

const inputClass = "mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-navy";
const labelClass = "text-xs font-medium text-navy/85";

type SP = { q?: string; role?: string; statut?: string; profil?: string; ok?: string };

const when = (d: Date | null) => (d ? d.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "jamais");

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireAdminPage("utilisateurs");
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 80);

  const where: Prisma.UserWhereInput = {
    ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { phone: { contains: q.replace(/\D/g, "") || q } }] } : {}),
    ...(isRoleName(sp.role) ? { role: sp.role } : {}),
    ...(sp.statut === "actif" ? { active: true } : sp.statut === "suspendu" ? { active: false } : {}),
    ...(sp.profil === "complet" ? { role: "ADMIN", profileId: null } : sp.profil ? { profileId: sp.profil } : {}),
  };

  const [users, total, byRole, suspended, profiles, consultants, livreurs] = await Promise.all([
    prisma.user.findMany({ where, orderBy: [{ createdAt: "desc" }], take: 300, include: { consultant: { select: { name: true } }, livreur: { select: { name: true } }, profile: { select: { name: true } } } }),
    prisma.user.count(),
    prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
    prisma.user.count({ where: { active: false } }),
    prisma.accessProfile.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.consultant.findMany({ where: { user: null }, orderBy: { name: "asc" } }),
    prisma.livreur.findMany({ where: { user: null }, orderBy: { name: "asc" } }),
  ]);
  const count = (r: string) => byRole.find((x) => x.role === r)?._count._all ?? 0;
  const filtered = !!(q || sp.role || sp.statut || sp.profil);

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif-display text-2xl font-semibold text-navy">Utilisateurs ({total})</h1>
          <p className="mt-1 text-sm text-navy/75">Comptes, rôles et privilèges. Un administrateur sans profil a l&apos;accès complet ; avec un profil, il n&apos;accède qu&apos;aux modules choisis.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/utilisateurs/profils" className="rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light">Profils et privilèges</Link>
          <Link href="/admin/historique" className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-navy hover:bg-cream">Journal des actions</Link>
        </div>
      </div>

      {sp.ok && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-800">{sp.ok}</p>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {([["ADMIN", "Administrateurs"], ["CONSULTANT", "Consultants"], ["LIVREUR", "Livreurs"], ["CLIENT", "Clients"]] as const).map(([r, label]) => (
          <Link key={r} href={`/admin/utilisateurs?role=${r}`} className="rounded-2xl border border-line bg-white p-4 hover:border-navy/40">
            <p className="text-xs uppercase text-navy/60">{label}</p>
            <p className="text-2xl font-semibold text-navy">{count(r)}</p>
          </Link>
        ))}
        <Link href="/admin/utilisateurs?statut=suspendu" className={`rounded-2xl border p-4 hover:border-navy/40 ${suspended ? "border-amber-300 bg-amber-50" : "border-line bg-white"}`}>
          <p className="text-xs uppercase text-navy/60">Suspendus</p>
          <p className="text-2xl font-semibold text-navy">{suspended}</p>
        </Link>
      </div>

      <form className="grid gap-3 rounded-2xl border border-line bg-white p-4 sm:grid-cols-5" method="get">
        <label className={`${labelClass} sm:col-span-2`}>
          Recherche
          <input name="q" defaultValue={q} placeholder="Nom, e-mail ou téléphone" className={inputClass} />
        </label>
        <label className={labelClass}>
          Rôle
          <select name="role" defaultValue={sp.role ?? ""} className={inputClass}>
            <option value="">Tous</option>
            {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className={labelClass}>
          Statut
          <select name="statut" defaultValue={sp.statut ?? ""} className={inputClass}>
            <option value="">Tous</option>
            <option value="actif">Actifs</option>
            <option value="suspendu">Suspendus</option>
          </select>
        </label>
        <label className={labelClass}>
          Privilèges
          <select name="profil" defaultValue={sp.profil ?? ""} className={inputClass}>
            <option value="">Tous</option>
            <option value="complet">Administrateurs complets</option>
            {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <div className="flex items-end gap-2 sm:col-span-5">
          <button className="rounded-full bg-navy px-5 py-2 text-sm font-semibold text-white hover:bg-navy-light">Filtrer</button>
          {filtered && <Link href="/admin/utilisateurs" className="text-sm font-semibold text-navy/70 underline">Effacer les filtres</Link>}
          <span className="ml-auto text-xs text-navy/60">{users.length} résultat(s){users.length === 300 ? " (300 premiers)" : ""}</span>
        </div>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full text-sm">
          <thead className="bg-cream text-left text-xs uppercase text-navy/70">
            <tr>
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">E-mail / Téléphone</th>
              <th className="px-4 py-3">Rôle</th>
              <th className="px-4 py-3">Privilèges</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3">Dernière connexion</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={`border-t border-line ${u.active ? "" : "bg-amber-50/50"}`}>
                <td className="px-4 py-3">
                  <Link href={`/admin/utilisateurs/${u.id}`} className="font-medium text-navy hover:underline">{u.name}</Link>
                  {(u.consultant || u.livreur) && <p className="text-xs text-navy/60">Fiche : {u.consultant?.name ?? u.livreur?.name}</p>}
                </td>
                <td className="px-4 py-3 text-navy/85">{[u.email, u.phone].filter(Boolean).join(" · ") || "—"}</td>
                <td className="px-4 py-3 text-navy/85">{isRoleName(u.role) ? ROLE_LABEL[u.role] : u.role}</td>
                <td className="px-4 py-3 text-navy/85">
                  {u.role === "ADMIN" ? (u.profile ? <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-900">{u.profile.name}</span> : <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">Accès complet</span>) : "—"}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${u.active ? "bg-emerald-50 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>{u.active ? "Actif" : "Suspendu"}</span>
                  {!u.consultantId && !u.livreurId && (u.role === "CONSULTANT" || u.role === "LIVREUR") && <p className="mt-1 text-xs text-amber-800">Non rattaché à une fiche</p>}
                </td>
                <td className="px-4 py-3 text-xs text-navy/75">{when(u.lastLoginAt)}</td>
                <td className="px-4 py-3 text-right"><Link href={`/admin/utilisateurs/${u.id}`} className="text-xs font-semibold text-navy underline">Gérer</Link></td>
              </tr>
            ))}
            {users.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-navy/70">Aucun utilisateur ne correspond.</td></tr>}
          </tbody>
        </table>
      </div>

      <section className="max-w-md">
        <h2 className="mb-3 font-serif-display text-lg font-semibold text-navy">Ajouter un utilisateur</h2>
        <p className="mb-3 text-xs text-navy/70">Pour un nouveau revendeur, préférez <strong>Consultants › Nouveau</strong> puis « Créer l&apos;accès » (il choisit lui-même son mot de passe). Ici, un compte Consultant ou Livreur reçoit toujours une fiche : la fiche choisie, ou une nouvelle.</p>
        <form action={createUser} className="grid gap-4">
          <div>
            <label className={labelClass}>Nom</label>
            <input name="name" required className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>E-mail</label>
            <input type="email" name="email" className={inputClass} />
            <p className="mt-1 text-xs text-navy/60">Facultatif si un téléphone est indiqué ci-dessous.</p>
          </div>
          <div>
            <label className={labelClass}>Mot de passe</label>
            <input type="password" name="password" required minLength={8} className={inputClass} />
            <p className="mt-1 text-xs text-navy/60">8 caractères au moins, avec une lettre et un chiffre.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Ville (nouvelle fiche)</label>
              <input name="city" defaultValue="Dakar" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Téléphone (connexion + WhatsApp)</label>
              <input name="phone" inputMode="tel" className={inputClass} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Rôle</label>
            <select name="role" defaultValue="CONSULTANT" className={inputClass}>
              <option value="CONSULTANT">Consultant</option>
              <option value="LIVREUR">Livreur</option>
              <option value="ADMIN">Administrateur</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Privilèges (si rôle Administrateur)</label>
            <select name="profileId" defaultValue="__full__" className={inputClass}>
              <option value="__full__">Accès complet</option>
              {profiles.map((p) => <option key={p.id} value={p.id}>Profil : {p.name}</option>)}
            </select>
            <p className="mt-1 text-xs text-navy/60">Un profil limite l&apos;administrateur aux modules choisis. <Link href="/admin/utilisateurs/profils" className="underline">Gérer les profils</Link></p>
          </div>
          <div>
            <label className={labelClass}>Fiche revendeur (si rôle Consultant)</label>
            <select name="consultantId" defaultValue="__new__" className={inputClass}>
              <option value="__new__">Créer une nouvelle fiche revendeur</option>
              {consultants.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.city})</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Fiche livreur (si rôle Livreur)</label>
            <select name="livreurId" defaultValue="__new__" className={inputClass}>
              <option value="__new__">Créer une nouvelle fiche livreur</option>
              {livreurs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <button className="rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy-light">Créer le compte</button>
        </form>
      </section>
    </div>
  );
}
