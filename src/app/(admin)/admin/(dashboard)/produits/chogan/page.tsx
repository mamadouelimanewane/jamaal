import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-page-guard";
import { getCategories } from "@/lib/db-categories";
import { ChoganImporter } from "@/components/admin/ChoganImporter";

export const metadata = { title: "Importer depuis Chogan" };
export const maxDuration = 60;

export default async function ChoganImportPage() {
  await requireAdminPage("catalogue");
  const categories = await getCategories();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Link href="/admin/produits" aria-label="Retour aux produits" className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-navy hover:bg-cream">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="font-serif-display text-2xl font-semibold text-navy">Importer depuis Chogan</h1>
          <p className="text-sm text-navy/70">Codes, n° de fiche, liens ou noms de produit : la fiche, les prix et les photos sont repris du site Chogan.</p>
          <p className="mt-1 text-sm text-navy/70"><strong>Nouveautés :</strong> tapez le nom d&apos;une gamme (ex. <em>Aurodhea</em>, <em>soin visage</em>) puis « Préparer ces fiches » pour ajouter d&apos;un coup tous les produits absents du catalogue.</p>
        </div>
      </div>
      <ChoganImporter categories={categories.map((c) => ({ slug: c.slug, label: c.label }))} />
    </div>
  );
}
