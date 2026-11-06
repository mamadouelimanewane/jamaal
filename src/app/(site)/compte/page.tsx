import { getT } from "@/lib/i18n/server";
import type { Metadata } from "next";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Mon compte"), description: t("Suivez vos commandes et gérez votre compte client JAMAAL.") };
}

export default async function AccountPage() {
  const t = await getT();
  return (
    <div className="mx-auto max-w-md px-4 py-14 sm:px-6">
      <h1 className="font-serif-display text-2xl font-semibold text-navy">{t("Mon compte")}</h1>
      <p className="mt-3 text-sm text-navy/70">
        {t("L'espace client (connexion, historique de commandes) sera disponible lors du branchement d'un vrai backend / vraie authentification.")}
      </p>
    </div>
  );
}
