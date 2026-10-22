import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-page-guard";
import { getSkinVisuals, MAX_VISUALS, VISUAL_PROMPTS } from "@/lib/skin/visuals";
import { visionConfigured } from "@/lib/ai/gemini";
import { SkinVisualsManager } from "@/components/admin/SkinVisualsManager";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const metadata = { title: "Skin Advisor" };

export default async function SkinAdvisorAdminPage() {
  await requireAdminPage("marketing");
  const visuals = await getSkinVisuals();
  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif-display text-2xl font-semibold text-navy">Skin Advisor</h1>
          <p className="mt-1 text-sm text-navy/75">
            Analyse de peau par selfie pour les clients (pensée pour les peaux noires et métissées), avec une routine de soins du catalogue.
            Analyse photo : {visionConfigured() ? <strong className="text-emerald-700">activée</strong> : <strong className="text-amber-800">inactive (GOOGLE_AI_API_KEY manquante) : routine d&apos;après le questionnaire</strong>}.
          </p>
        </div>
        <Link href="/skin-advisor" target="_blank" className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-navy hover:bg-cream">Voir la page ↗</Link>
      </div>
      <SkinVisualsManager visuals={visuals} presets={VISUAL_PROMPTS.map((p) => ({ id: p.id, label: p.label }))} max={MAX_VISUALS} aiReady={!!process.env.GOOGLE_AI_API_KEY} />
      <p className="text-sm text-navy/70">Les recommandations viennent des soins du visage du catalogue : ajoutez la nouvelle gamme <strong>Aurodhea</strong> depuis <Link href="/admin/produits/chogan" className="font-semibold text-rose-dark hover:underline">Produits › Importer depuis Chogan</Link>.</p>
    </div>
  );
}
