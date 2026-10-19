import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-page-guard";
import { prisma } from "@/lib/prisma";
import { createUser } from "@/lib/actions/users";
import { PROFILE_TEMPLATES, normalizePermissions, summarizePermissions } from "@/lib/permissions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ajouter un utilisateur" };

const inputClass = "mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-navy";
const labelClass = "text-xs font-medium text-navy/85";

export default async function NewUserPage() {
  await requireAdminPage("utilisateurs");
  const [profiles, consultants, livreurs] = await Promise.all([
    prisma.accessProfile.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, description: true, permissions: true } }),
    prisma.consultant.findMany({ where: { user: null }, orderBy: { name: "asc" } }),
    prisma.livreur.findMany({ where: { user: null }, orderBy: { name: "asc" } }),
  ]);

  // Types d'administrateur : profil existant, sinon modèle proposé (créé à la première utilisation). Superviseur en premier.
  const byName = new Map(profiles.map((p) => [p.name.toLowerCase(), p]));
  const teamTypes: { value: string; label: string; detail: string }[] = [
    { value: "ADMIN_FULL", label: "Administrateur (accès complet)", detail: "Voit et modifie tout : modules, comptes, privilèges, réglages." },
  ];
  PROFILE_TEMPLATES.forEach((t, i) => {
    const existing = byName.get(t.name.toLowerCase());
    teamTypes.push({ value: existing ? `profil:${existing.id}` : `modele:${i}`, label: t.name, detail: `${t.description} (${summarizePermissions(existing ? normalizePermissions(existing.permissions) : t.permissions)})` });
  });
  const templateNames = new Set(PROFILE_TEMPLATES.map((t) => t.name.toLowerCase()));
  for (const p of profiles) if (!templateNames.has(p.name.toLowerCase())) teamTypes.push({ value: `profil:${p.id}`, label: p.name, detail: `${p.description ?? "Profil personnalisé"} (${summarizePermissions(normalizePermissions(p.permissions))})` });

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <Link href="/admin/utilisateurs" className="text-xs text-navy/70 hover:underline">← Utilisateurs</Link>
        <h1 className="mt-1 font-serif-display text-2xl font-semibold text-navy">Ajouter un nouvel utilisateur</h1>
        <p className="mt-1 text-sm text-navy/75">Choisissez le type de compte : administrateur, superviseur, un autre profil de l&apos;équipe, ou un intervenant (consultant, livreur).</p>
      </div>

      <form action={createUser} className="grid gap-4 rounded-2xl border border-line bg-white p-5 sm:grid-cols-2">
        <label className={`${labelClass} sm:col-span-2`}>
          Type de compte
          <select name="accountType" defaultValue="ADMIN_FULL" className={inputClass}>
            <optgroup label="Équipe d'administration">
              {teamTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </optgroup>
            <optgroup label="Intervenants">
              <option value="CONSULTANT">Consultant (revendeur)</option>
              <option value="LIVREUR">Livreur</option>
            </optgroup>
          </select>
        </label>

        <label className={labelClass}>Nom et prénom<input name="name" required minLength={2} className={inputClass} /></label>
        <label className={labelClass}>
          Téléphone (connexion + WhatsApp)
          <input name="phone" inputMode="tel" placeholder="77 123 45 67" className={inputClass} />
        </label>
        <label className={labelClass}>
          E-mail
          <input type="email" name="email" className={inputClass} />
          <span className="mt-1 block text-xs text-navy/60">Facultatif si un téléphone est indiqué : l&apos;un des deux sert d&apos;identifiant de connexion.</span>
        </label>
        <label className={labelClass}>
          Mot de passe (facultatif)
          <input type="password" name="password" minLength={8} autoComplete="new-password" className={inputClass} />
          <span className="mt-1 block text-xs text-navy/60">8 caractères, une lettre et un chiffre. Laissez vide : vous générerez un lien d&apos;accès et la personne choisira son mot de passe.</span>
        </label>

        <fieldset className="grid gap-3 rounded-xl bg-cream/50 p-3 sm:col-span-2 sm:grid-cols-3">
          <legend className="px-1 text-xs font-semibold text-navy/80">Pour un consultant ou un livreur</legend>
          <label className={labelClass}>Ville (nouvelle fiche)<input name="city" defaultValue="Dakar" className={inputClass} /></label>
          <label className={labelClass}>
            Fiche revendeur
            <select name="consultantId" defaultValue="__new__" className={inputClass}>
              <option value="__new__">Créer une nouvelle fiche</option>
              {consultants.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.city})</option>)}
            </select>
          </label>
          <label className={labelClass}>
            Fiche livreur
            <select name="livreurId" defaultValue="__new__" className={inputClass}>
              <option value="__new__">Créer une nouvelle fiche</option>
              {livreurs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </label>
        </fieldset>

        <div className="sm:col-span-2">
          <button className="rounded-full bg-navy px-6 py-2.5 text-sm font-semibold text-white hover:bg-navy-light">Créer le compte</button>
          <Link href="/admin/utilisateurs" className="ml-4 text-sm font-semibold text-navy/70 underline">Annuler</Link>
        </div>
      </form>

      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="mb-2 font-semibold text-navy">Les types de compte</h2>
        <ul className="space-y-2 text-sm">
          {teamTypes.map((t) => (
            <li key={t.value}><strong className="text-navy">{t.label}</strong> <span className="text-navy/70">· {t.detail}</span></li>
          ))}
          <li><strong className="text-navy">Consultant (revendeur)</strong> <span className="text-navy/70">· vend et suit ses gains dans son espace ; reçoit une fiche et un lien de vente.</span></li>
          <li><strong className="text-navy">Livreur</strong> <span className="text-navy/70">· voit ses livraisons et sa part ; reçoit une fiche livreur.</span></li>
        </ul>
        <p className="mt-3 text-xs text-navy/60">Les profils (Superviseur, Comptable…) se modifient dans <Link href="/admin/utilisateurs/profils" className="underline">Profils et privilèges</Link>. Un type proposé est créé automatiquement à sa première utilisation.</p>
      </section>
    </div>
  );
}
