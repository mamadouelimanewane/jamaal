import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/actions/auth-guard";
import { continueCampaign } from "@/lib/actions/whatsapp-inbox";
import { campaignRecipients, parseAudience } from "@/lib/whatsapp/campaigns";
import { whatsappConfig } from "@/lib/whatsapp";
import { fetchKwingoMetaTemplates, getKwingoConnection } from "@/lib/whatsapp/kwingo-bridge";
import { WhatsAppCampaignBuilder } from "@/components/admin/WhatsAppCampaignBuilder";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const STATUS: Record<string, string> = { BROUILLON: "Brouillon", EN_COURS: "En cours", ENVOYEE: "Envoyée" };

type SP = {
  target?: string;
  inactiveDays?: string;
  category?: string;
  consultantId?: string;
  body?: string;
  title?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  templateName?: string;
  templateLanguage?: string;
  erreur?: string;
  c?: string;
};

export default async function CampagnesPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireAdmin("whatsapp", "read");
  const sp = await searchParams;
  const audience = parseAudience({
    target: sp.target,
    inactiveDays: sp.inactiveDays,
    category: sp.category,
    consultantId: sp.consultantId,
    cta: { label: sp.ctaLabel, url: sp.ctaUrl },
  });

  const [categories, consultants, campaigns, recipients, metaTemplates, kwingoConn] = await Promise.all([
    prisma.category.findMany({ orderBy: { position: "asc" }, select: { slug: true, label: true } }),
    prisma.consultant.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, city: true } }),
    prisma.whatsAppCampaign.findMany({ orderBy: { createdAt: "desc" }, take: 30 }).catch(() => null),
    campaignRecipients(audience).catch(() => []),
    fetchKwingoMetaTemplates().catch(() => []),
    getKwingoConnection(),
  ]);

  const cfg = whatsappConfig();
  const isCloudConnected = cfg.active || kwingoConn.connected;

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-serif-display text-2xl font-semibold text-navy">Campagnes WhatsApp</h1>
            <span className="rounded-full bg-navy px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white">
              Réservé aux administrateurs
            </span>
          </div>
          <p className="mt-1 text-sm text-navy/75">
            Choisissez un modèle approuvé par Meta (API Cloud JAMAAL Luxury +221 71 180 09 09), puis ciblez vos destinataires selon les filtres de la base et/ou en téléversant une liste Excel (<code>.xlsx</code>, <code>.csv</code>).
          </p>
        </div>
        <Link
          href="/admin/whatsapp/conversations"
          className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-navy hover:bg-cream"
        >
          Messagerie WhatsApp JAMAAL
        </Link>
      </div>

      {!isCloudConnected && (
        <p className="rounded-xl bg-amber-50 px-4 py-2 text-sm text-amber-800 border border-amber-200">
          Mode simulation : les messages seront enregistrés dans le journal sans être envoyés tant que le compte KwingoChat / Jamaal Luxury n&apos;est pas connecté.
        </p>
      )}
      {sp.erreur && (
        <p className="rounded-xl bg-rose/10 px-4 py-2 text-sm font-medium text-rose-dark border border-rose/20">
          {sp.erreur}
        </p>
      )}

      <WhatsAppCampaignBuilder
        metaTemplates={metaTemplates}
        categories={categories}
        consultants={consultants}
        filteredRecipients={recipients}
        initialAudience={{
          target: audience.target,
          inactiveDays: audience.inactiveDays ?? 0,
          category: audience.category ?? "",
          consultantId: audience.consultantId ?? "",
          ctaLabel: sp.ctaLabel ?? "",
          ctaUrl: sp.ctaUrl ?? "",
        }}
        initialTemplateName={sp.templateName}
        initialTemplateLanguage={sp.templateLanguage}
        initialBody={sp.body}
        initialTitle={sp.title}
      />

      <section className="overflow-x-auto rounded-2xl border border-line bg-white shadow-2xs">
        <div className="border-b border-line px-5 py-3.5">
          <h2 className="font-serif-display text-base font-semibold text-navy">Historique des campagnes</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-cream text-left text-xs uppercase text-navy/70">
            <tr>
              <th className="px-4 py-3">Campagne</th>
              <th className="px-4 py-3">Modèle Meta & Source</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Statut</th>
              <th className="px-4 py-3">Envoyés</th>
              <th className="px-4 py-3">Échecs</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {(campaigns ?? []).map((c) => {
              const aud = parseAudience(c.audience);
              return (
                <tr key={c.id} className={`border-t border-line ${sp.c === c.id ? "bg-ia-light/30" : ""}`}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-navy">{c.title}</p>
                    <p className="max-w-xs truncate text-xs text-navy/60">{c.body}</p>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-[#1f9d55] border border-emerald-200">
                        {aud.templateName || "Modèle Meta"} ({aud.templateLanguage || "fr"})
                      </span>
                      {aud.excelFileName && (
                        <span className="rounded-full bg-cream px-2 py-0.5 text-[11px] font-medium text-navy/80">
                          Excel : {aud.excelFileName}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs">
                    {(c.sentAt ?? c.createdAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                  </td>
                  <td className="px-4 py-3 text-xs">{STATUS[c.status] ?? c.status}</td>
                  <td className="px-4 py-3 text-xs">
                    {c.sent} / {c.total}
                  </td>
                  <td className="px-4 py-3 text-xs">{c.failed}</td>
                  <td className="px-4 py-3 text-right">
                    {c.status !== "ENVOYEE" && (
                      <form action={continueCampaign.bind(null, c.id)}>
                        <button className="rounded-full bg-ia px-3 py-1.5 text-xs font-semibold text-white hover:bg-ia-dark">
                          {c.status === "BROUILLON" ? "Envoyer" : "Continuer"}
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
            {campaigns === null && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-navy/60">
                  Disponible après la mise à jour de la base (migration 21).
                </td>
              </tr>
            )}
            {campaigns?.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-navy/60">
                  Aucune campagne pour le moment.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
