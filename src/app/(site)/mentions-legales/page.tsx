import { getT } from "@/lib/i18n/server";
import type { Metadata } from "next";
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Mentions légales"), description: t("Mentions légales du site JAMAAL, revendeur officiel Chogan au Sénégal.") };
}

export default async function MentionsLegalesPage() {
  const t = await getT();
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 text-sm leading-relaxed text-navy/80 sm:px-6">
      <h1 className="font-serif-display text-3xl font-semibold text-navy">{t("Mentions légales")}</h1>
      <p className="mt-6">
        {t("Ce site est un prototype de démonstration (« JAMAAL Luxury Cosmetics ») réalisé à titre d'exemple. Les informations légales définitives (raison sociale, SIRET/NINEA, adresse du siège, hébergeur, directeur de la publication) doivent être complétées avant toute mise en exploitation commerciale réelle.")}
      </p>
      <p className="mt-4">
        {t("Les produits, descriptions et visuels présents sur ce site de démonstration sont fictifs et n'engagent aucune marque tierce.")}
      </p>
    </div>
  );
}
