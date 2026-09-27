import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createUser, deleteUser } from "@/lib/actions/users";

export const dynamic = "force-dynamic";

const inputClass =
  "mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-navy";
const labelClass = "text-xs font-medium text-navy/70";

export default async function AdminUsersPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/admin");

  const [users, consultants, livreurs] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: "asc" }, include: { consultant: true, livreur: true } }),
    prisma.consultant.findMany({ where: { user: null }, orderBy: { name: "asc" } }),
    prisma.livreur.findMany({ where: { user: null }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <h1 className="font-serif-display text-2xl font-semibold text-navy">
        Utilisateurs ({users.length})
      </h1>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full text-sm">
          <thead className="bg-cream text-left text-xs uppercase text-navy/50">
            <tr>
              <th className="px-4 py-3">Nom</th>
              <th className="px-4 py-3">E-mail</th>
              <th className="px-4 py-3">Rôle</th>
              <th className="px-4 py-3">Rattachement</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-line">
                <td className="px-4 py-3 font-medium text-navy">{u.name}</td>
                <td className="px-4 py-3 text-navy/70">{u.email}</td>
                <td className="px-4 py-3 text-navy/70">{u.role}</td>
                <td className="px-4 py-3 text-navy/70">
                  {u.consultant?.name ?? u.livreur?.name ?? "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  {u.id !== session.user.id && (
                    <form action={deleteUser.bind(null, u.id)} className="inline">
                      <button className="text-xs font-semibold text-rose-dark hover:underline">
                        Supprimer
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-8 max-w-md">
        <h2 className="mb-3 font-serif-display text-lg font-semibold text-navy">
          Ajouter un utilisateur
        </h2>
        <form action={createUser} className="grid gap-4">
          <div>
            <label className={labelClass}>Nom</label>
            <input name="name" required className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>E-mail</label>
            <input type="email" name="email" required className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Mot de passe</label>
            <input type="password" name="password" required minLength={8} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Rôle</label>
            <select name="role" defaultValue="CONSULTANT" className={inputClass}>
              <option value="CONSULTANT">Consultant / Revendeur</option>
              <option value="LIVREUR">Livreur</option>
              <option value="ADMIN">Administrateur</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Fiche revendeur à rattacher (si rôle Consultant)</label>
            <select name="consultantId" defaultValue="" className={inputClass}>
              <option value="">— Aucune —</option>
              {consultants.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.city})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Fiche livreur à rattacher (si rôle Livreur)</label>
            <select name="livreurId" defaultValue="" className={inputClass}>
              <option value="">— Aucune —</option>
              {livreurs.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="mt-2 w-fit rounded-full bg-navy px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-light"
          >
            Créer le compte
          </button>
        </form>
      </div>
    </div>
  );
}
