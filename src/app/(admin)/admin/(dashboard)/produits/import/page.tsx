import { ImportForm } from "./ImportForm";
import Link from "next/link";

export const metadata = {
  title: "Importer Produits - Admin Jamaal",
};

export default function ImportPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/admin/produits"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-navy hover:bg-cream"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="font-serif-display text-2xl font-semibold text-navy">
          Importation Excel Chogan
        </h1>
      </div>
      
      <ImportForm />
    </div>
  );
}
