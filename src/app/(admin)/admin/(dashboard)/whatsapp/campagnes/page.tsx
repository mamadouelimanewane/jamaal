import Link from "next/link";
import { Copy, Edit3, Play, Trash2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/actions/auth-guard";
import {
  deleteCampaignAction,
  duplicateCampaignAction,
  launchCampaignAction,
} from "@/lib/actions/whatsapp-inbox";
import { campaignRecipients, parseAudience } from "@/lib/whatsapp/campaigns";
import { whatsappConfig } from "@/lib/whatsapp";
import { fetchKwingoMetaTemplates, getKwingoConnection } from "@/lib/whatsapp/kwingo-bridge";
import { WhatsAppCampaignBuilder } from "@/components/admin/WhatsAppCampaignBuilder";
import { WhatsAppSubNav } from "@/components/admin/WhatsAppSubNav";

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
  edit?: string;
  erreur?: string;
  c?: string;
};

export default async function CampagnesPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireAdmin("whatsapp", "read");
  const sp = await searchParams;

  const editingDraft = sp.edit
    ? await prisma.whatsAppCampaign.findUnique({ where: { id: sp.edit } }).catch(() => null)
    : null;
  const draftAudience = editingDraft ? parseAudience(editingDraft.audience) : null;

  const audience = parseAudience({
    target: sp.target ?? draftAudience?.target,
    inactiveDays: sp.inactiveDays ?? (draftAudience?.inactiveDays !== undefined ? String(draftAudience.inactiveDays) : undefined),
    category: sp.category ?? draftAudience?.category,
    consultantId: sp.consultantId ?? draftAudience?.consultantId,
    cta: {
      label: sp.ctaLabel ?? draftAudience?.cta?.label,
      url: sp.ctaUrl ?? draftAudience?.cta?.url,
    },
  });

  const [categories, consultants, campaigns, recipients, metaTemplates, kwingoConn] = await Promise.all([
    prisma.category.findMany({ orderBy: { position: "asc" }, select: { slug: true, label: true } }),
    prisma.consultant.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, city: true } }),
    prisma.whatsAppCampaign.findMany({ orderBy: { createdAt: "desc" }, take: 200 }).catch(() => null),
    campaignRecipients(audience).catch(() => []),
    fetchKwingoMetaTemplates().catch(() => []),
    getKwingoConnection(),
  ]);

  const cfg = whatsappConfig();
  const isCloudConnected = cfg.active || kwingoConn.connected;

  const drafts = (campaigns ?? []).filter((c) => c.status === "BROUILLON");
  const sentOrRunning = (campaigns ?? []).filter((c) => c.status !== "BROUILLON");

  return (
    <div className="max-w-6xl space-y-6">
      <WhatsAppSubNav connected={isCloudConnected} />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-serif-display text-2xl font-semibold text-navy">
              Campagnes WhatsApp & Brouillons
            </h1>
            <span className="rounded-full bg-navy px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white">
              Réservé aux administrateurs
            </span>
          </div>
          <p className="mt-1 text-sm text-navy/75">
            Préparez autant de brouillons que souhaité (modèle approuvé par Meta + filtres ou fichier Excel), puis lancez-les ou supprimez-les à la volée.
          </p>
        </div>

        {editingDraft && (
          <Link
            href="/admin/whatsapp/campagnes"
            className="rounded-full border border-line bg-white px-4 py-2 text-xs font-semibold text-navy hover:bg-cream"
          >
            + Nouveau brouillon vierge
          </Link>
        )}
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

      {/* SECTION BROUILLONS PRÊTS À LANCER OU SUPPRIMER À LA VOLÉE */}
      <section className="rounded-2xl border border-line bg-white p-5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3.5">
          <div>
            <h2 className="font-serif-display text-lg font-semibold text-navy">
              Brouillons prêts à lancer ({drafts.length})
            </h2>
            <p className="text-xs text-navy/65">
              Lancez un brouillon en un clic via l&apos;API Cloud JAMAAL Luxury, dupliquez-le pour préparer une série, modifiez-le ou supprimez-le à la volée.
            </p>
          </div>
        </div>

        {drafts.length === 0 ? (
          <p className="py-6 text-center text-xs text-navy/60">
            Aucun brouillon en attente. Utilisez le constructeur ci-dessous et cliquez sur <strong>« + Enregistrer en brouillon »</strong> pour préparer vos campagnes.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {drafts.map((d) => {
              const aud = parseAudience(d.audience);
              const isBeingEdited = editingDraft?.id === d.id;
              const isHighlighted = sp.c === d.id || isBeingEdited;
              return (
                <div
                  key={d.id}
                  className={`flex flex-col justify-between rounded-2xl border p-4 transition ${
                    isHighlighted
                      ? "border-[#25D366] bg-emerald-50/40"
                      : "border-line bg-cream/25 hover:border-navy/40"
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-navy">{d.title}</p>
                        <p className="text-[11px] text-navy/55">
                          Créé le {d.createdAt.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                          {d.total > 0 ? ` · ${d.total} destinataire(s)` : ""}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold uppercase text-amber-900">
                        Brouillon
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-[#1f9d55]">
                        ✓ {aud.templateName || "Modèle Meta"} ({aud.templateLanguage || "fr"})
                      </span>
                      <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-navy/75 border border-line">
                        {aud.sourceMode === "EXCEL"
                          ? `Liste Excel (${aud.excelRecipients?.length ?? d.total})`
                          : aud.sourceMode === "FILTRES_ET_EXCEL"
                            ? `Filtres + Excel`
                            : aud.target === "REVENDEURS"
                              ? "Revendeurs actifs"
                              : "Clients filtrés"}
                      </span>
                      {aud.excelFileName && (
                        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] text-navy/70 border border-line">
                          {aud.excelFileName}
                        </span>
                      )}
                    </div>

                    <p className="mt-2.5 line-clamp-2 rounded-xl border border-line/60 bg-white px-3 py-2 text-xs text-navy/80">
                      {d.body}
                    </p>
                  </div>

                  {/* Actions à la volée : Lancer, Modifier, Dupliquer, Supprimer */}
                  <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-line/60 pt-3">
                    <form action={launchCampaignAction}>
                      <input type="hidden" name="id" value={d.id} />
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1.5 rounded-full bg-[#25D366] px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-[#1ebe5b]"
                      >
                        <Play size={12} /> Lancer maintenant
                      </button>
                    </form>

                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/admin/whatsapp/campagnes?edit=${d.id}`}
                        className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold text-navy hover:bg-cream"
                        title="Charger ce brouillon dans l'éditeur"
                      >
                        <Edit3 size={12} /> Modifier
                      </Link>

                      <form action={duplicateCampaignAction}>
                        <input type="hidden" name="id" value={d.id} />
                        <button
                          type="submit"
                          className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold text-navy hover:bg-cream"
                          title="Dupliquer ce brouillon"
                        >
                          <Copy size={12} /> Dupliquer
                        </button>
                      </form>

                      <form action={deleteCampaignAction}>
                        <input type="hidden" name="id" value={d.id} />
                        <button
                          type="submit"
                          className="inline-flex items-center gap-1 rounded-full border border-rose/30 bg-white px-3 py-1.5 text-xs font-semibold text-rose-dark hover:bg-rose/10"
                          title="Supprimer ce brouillon à la volée"
                        >
                          <Trash2 size={12} /> Supprimer
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <WhatsAppCampaignBuilder
        key={editingDraft?.id ?? "new"}
        metaTemplates={metaTemplates}
        categories={categories}
        consultants={consultants}
        filteredRecipients={recipients}
        initialAudience={{
          target: audience.target,
          inactiveDays: audience.inactiveDays ?? 0,
          category: audience.category ?? "",
          consultantId: audience.consultantId ?? "",
          ctaLabel: sp.ctaLabel ?? draftAudience?.cta?.label ?? "",
          ctaUrl: sp.ctaUrl ?? draftAudience?.cta?.url ?? "",
        }}
        initialTemplateName={sp.templateName ?? draftAudience?.templateName}
        initialTemplateLanguage={sp.templateLanguage ?? draftAudience?.templateLanguage}
        initialTemplateVarBindings={draftAudience?.templateVarBindings}
        initialBody={sp.body ?? editingDraft?.body}
        initialTitle={sp.title ?? editingDraft?.title}
        initialSourceMode={draftAudience?.sourceMode}
        initialExcelRecipients={draftAudience?.excelRecipients}
        initialExcelFileName={draftAudience?.excelFileName}
        editingDraftId={editingDraft?.id}
      />

      {/* HISTORIQUE DES CAMPAGNES LANCÉES / EN COURS */}
      <section className="overflow-x-auto rounded-2xl border border-line bg-white shadow-2xs">
        <div className="border-b border-line px-5 py-3.5">
          <h2 className="font-serif-display text-base font-semibold text-navy">
            Campagnes lancées & Historique ({sentOrRunning.length})
          </h2>
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
              <th className="px-4 py-3 text-right">Actions à la volée</th>
            </tr>
          </thead>
          <tbody>
            {sentOrRunning.map((c) => {
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
                    <div className="inline-flex items-center justify-end gap-1.5">
                      {c.status !== "ENVOYEE" && (
                        <form action={launchCampaignAction}>
                          <input type="hidden" name="id" value={c.id} />
                          <button
                            type="submit"
                            className="inline-flex items-center gap-1 rounded-full bg-ia px-3 py-1.5 text-xs font-semibold text-white hover:bg-ia-dark"
                          >
                            <Play size={11} /> Continuer
                          </button>
                        </form>
                      )}
                      <form action={duplicateCampaignAction}>
                        <input type="hidden" name="id" value={c.id} />
                        <button
                          type="submit"
                          className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-2.5 py-1.5 text-xs font-semibold text-navy hover:bg-cream"
                          title="Recréer un brouillon à partir de cette campagne"
                        >
                          <Copy size={11} /> Brouillon
                        </button>
                      </form>
                      <form action={deleteCampaignAction}>
                        <input type="hidden" name="id" value={c.id} />
                        <button
                          type="submit"
                          className="inline-flex items-center gap-1 rounded-full border border-rose/30 bg-white px-2.5 py-1.5 text-xs font-semibold text-rose-dark hover:bg-rose/10"
                          title="Supprimer cette campagne"
                        >
                          <Trash2 size={11} />
                        </button>
                      </form>
                    </div>
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
            {sentOrRunning.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-navy/60">
                  Aucune campagne envoyée pour le moment.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
