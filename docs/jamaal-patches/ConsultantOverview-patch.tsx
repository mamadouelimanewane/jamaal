/**
 * SNIPPET à intégrer dans ConsultantOverview
 * (src/app/(admin)/admin/(dashboard)/page.tsx)
 *
 * 1. Importer :
 *    import { PersonalLinkCard } from "@/components/admin/PersonalLinkCard";
 *
 * 2. Récupérer le slug (déjà disponible via user.consultant si le schéma est migré) :
 *    const personalSlug = (user.consultant as { slug?: string | null }).slug;
 *
 * 3. Ajouter le bloc juste après les StatCards (après la grille "Mes commandes / En cours / …") :
 */

import { PersonalLinkCard } from "@/components/admin/PersonalLinkCard";

// Exemple d'insertion dans le JSX de ConsultantOverview :
export function ExamplePersonalLinkSection({ slug }: { slug: string | null }) {
  return (
    <div className="mt-10">
      <PersonalLinkCard slug={slug} />
    </div>
  );
}

/*
Emplacement recommandé dans le return de ConsultantOverview :

  <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
    ...StatCards...
  </div>

  // ← ICI
  <div className="mt-10">
    <PersonalLinkCard slug={(user.consultant as { slug?: string | null }).slug} />
  </div>

  <div className="mt-10 grid gap-4 sm:grid-cols-2">
    ...commission + rang...
  </div>
*/
