import Link from "next/link";
import { MODULES, MODULE_LABEL, isModuleId, type Permissions } from "@/lib/permissions";

/** Accueil d'un administrateur restreint : uniquement les modules de son profil (jamais les chiffres de l'entreprise). */
export function RestrictedHome({ name, profileName, perms, refus }: { name: string; profileName: string | null; perms: Permissions; refus?: string }) {
  const granted = MODULES.filter((m) => perms[m.id]);
  return (
    <div className="max-w-3xl">
      <h1 className="font-serif-display text-2xl font-semibold text-navy">Bonjour {name.split(/\s+/)[0]}</h1>
      <p className="mt-1 text-sm text-navy/75">
        Votre profil : <strong>{profileName ?? "—"}</strong>. Vous avez accès aux modules ci-dessous ; les autres sont réservés à l&apos;administrateur principal.
      </p>
      {refus && (
        <p role="alert" className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
          {isModuleId(refus) ? `Votre profil n'a pas accès au module « ${MODULE_LABEL[refus]} ».` : "Cette page est réservée à l'administrateur principal."} Contactez-le si vous en avez besoin.
        </p>
      )}
      {granted.length ? (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {granted.map((m) => (
            <li key={m.id}>
              <Link href={m.paths[0]} className="block rounded-2xl border border-line bg-white p-4 transition hover:border-navy/40">
                <p className="font-semibold text-navy">{m.label}</p>
                <p className="mt-0.5 text-xs text-navy/70">{m.description}</p>
                <p className="mt-2 text-xs font-semibold text-rose-dark">{perms[m.id] === "write" ? "Lecture et modification" : "Lecture seule"}</p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 rounded-2xl border border-line bg-white p-6 text-sm text-navy/75">Aucun module n&apos;est encore attribué à votre profil. Contactez l&apos;administrateur principal.</p>
      )}
    </div>
  );
}
