import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/admin-page-guard";
import { prisma } from "@/lib/prisma";
import { parseZones, zonesToText } from "@/lib/special-terms";
import { SpecialTermsForm, type SpecialTermsInitial } from "@/components/admin/SpecialTermsForm";
import { consultantChoices, normalRates } from "../data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Conditions spéciales" };

export default async function SpecialTermsEditPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ cree?: string }> }) {
  await requireAdminPage("revendeurs", "write");
  const { id } = await params;
  const { cree } = await searchParams;
  const isNew = id === "nouveau";
  const t = isNew ? null : await prisma.specialTerms.findUnique({ where: { id }, include: { consultants: { select: { id: true } } } });
  if (!isNew && !t) notFound();
  const [consultants, rates] = await Promise.all([consultantChoices(), normalRates()]);
  const initial: SpecialTermsInitial = t
    ? { id: t.id, name: t.name, active: t.active, note: t.note ?? "", collectMethods: t.collectMethods, creditLimit: t.creditLimit, sellerPct: t.sellerPct, level1Pct: t.level1Pct, level2Pct: t.level2Pct, zonesText: zonesToText(parseZones(t.zones)), members: t.consultants.map((c) => c.id) }
    : { name: "", active: true, note: "", collectMethods: [], creditLimit: 0, sellerPct: null, level1Pct: null, level2Pct: null, zonesText: "", members: [] };
  return (
    <div className="max-w-4xl space-y-5">
      <div>
        <Link href="/admin/conditions-speciales" className="text-sm text-navy/70 hover:text-navy">← Conditions spéciales</Link>
        <h1 className="mt-1 font-serif-display text-2xl font-semibold text-navy">{t ? t.name : "Nouvelles conditions spéciales"}</h1>
      </div>
      {cree && t && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-900">Conditions créées : {t.consultants.length} revendeur(s) en bénéficient dès maintenant.</p>}
      <SpecialTermsForm key={t?.updatedAt.toISOString() ?? "new"} initial={initial} consultants={consultants} normalRates={rates} />
    </div>
  );
}
