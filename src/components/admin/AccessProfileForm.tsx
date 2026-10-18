import { MODULES, type Permissions } from "@/lib/permissions";
import { saveProfile } from "@/lib/actions/profiles";

const field = "mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-navy";

/** Formulaire d'un profil de privilèges : nom, description et grille module par module (aucun accès / lecture / écriture). */
export function AccessProfileForm({ id, name = "", description = "", permissions = {} }: { id?: string; name?: string; description?: string; permissions?: Permissions }) {
  // Le module « Utilisateurs » n'est jamais délégable : seul l'administrateur complet gère les comptes et les privilèges.
  const modules = MODULES.filter((m) => m.id !== "utilisateurs");
  return (
    <form action={saveProfile} className="space-y-4">
      {id && <input type="hidden" name="id" value={id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium text-navy/85">
          Nom du profil
          <input name="name" defaultValue={name} required minLength={2} maxLength={60} placeholder="Ex. Comptable" className={field} />
        </label>
        <label className="text-xs font-medium text-navy/85">
          Description (facultatif)
          <input name="description" defaultValue={description} maxLength={200} placeholder="À quoi sert ce profil" className={field} />
        </label>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="bg-cream text-left text-xs uppercase text-navy/70">
            <tr>
              <th className="px-3 py-2">Module</th>
              <th className="px-3 py-2 text-center">Aucun accès</th>
              <th className="px-3 py-2 text-center">Lecture</th>
              <th className="px-3 py-2 text-center">Écriture</th>
            </tr>
          </thead>
          <tbody>
            {modules.map((m) => {
              const cur = permissions[m.id] ?? "none";
              return (
                <tr key={m.id} className="border-t border-line">
                  <td className="px-3 py-2">
                    <p className="font-medium text-navy">{m.label}</p>
                    <p className="text-xs text-navy/65">{m.description}</p>
                  </td>
                  {(["none", "read", "write"] as const).map((lvl) => (
                    <td key={lvl} className="px-3 py-2 text-center">
                      <input type="radio" name={`perm_${m.id}`} value={lvl} defaultChecked={cur === lvl} aria-label={`${m.label} : ${lvl === "none" ? "aucun accès" : lvl === "read" ? "lecture" : "écriture"}`} className="h-4 w-4 accent-navy" />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-navy/65">
        Lecture : voir les pages et exporter. Écriture : en plus, créer, modifier et supprimer. Les comptes, les profils et les diagnostics restent réservés à l&apos;administrateur complet.
      </p>
      <button className="rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy-light">{id ? "Enregistrer le profil" : "Créer le profil"}</button>
    </form>
  );
}
