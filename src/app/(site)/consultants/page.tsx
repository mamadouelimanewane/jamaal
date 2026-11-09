import { getT } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { getConsultants } from "@/lib/db-content";
import { getConsultantRankings } from "@/lib/ranking";
import { RankBadge } from "@/components/admin/RankBadge";
import { ListSearch } from "@/components/ListSearch";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Nos consultants"), description: t("Trouvez un consultant JAMAAL près de chez vous, revendeur officiel Chogan au Sénégal.") };
}

export const dynamic = "force-dynamic";

const rankOrder = { GOLD: 0, SILVER: 1, BRONZE: 2 } as const;

export default async function ConsultantsPage() {
  const t = await getT();
  const [consultants, rankings] = await Promise.all([getConsultants(), getConsultantRankings()]);
  const rankById = new Map(rankings.map((r) => [r.consultantId, r.rank]));

  const sorted = [...consultants].sort((a, b) => {
    const ra = rankById.get(a.id) ?? null;
    const rb = rankById.get(b.id) ?? null;
    const oa = ra ? rankOrder[ra] : 3;
    const ob = rb ? rankOrder[rb] : 3;
    return oa - ob;
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="font-serif-display text-3xl font-semibold text-navy">
        {t("Nos consultant·es JAMAAL")}
      </h1>
      <p className="mt-3 text-sm text-navy/70">
        {t("Retrouvez un·e consultant·e près de chez vous pour un conseil personnalisé.")}
      </p>
      <div className="mt-6">
        <ListSearch target="consultants-list" total={sorted.length} placeholder={t("Rechercher un consultant : nom ou ville…")} />
      </div>
      <ul id="consultants-list" className="mt-5 flex flex-col gap-3">
        {sorted.map((c) => (
          <li
            key={c.id}
            data-search={`${c.name} ${c.city ?? ""}`}
            className="flex items-center justify-between rounded-2xl border border-line bg-white p-4"
          >
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-navy">{c.name}</p>
                <RankBadge rank={rankById.get(c.id) ?? null} />
              </div>
              <p className="text-xs text-navy/60">{c.city}</p>
            </div>
            <a href={c.whatsapp} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-rose-dark">
              {t("Contacter →")}
            </a>
          </li>
        ))}
        <li data-search-empty hidden className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-navy/65">
          {t("Aucun consultant ne correspond à cette recherche.")}
        </li>
      </ul>
    </div>
  );
}
