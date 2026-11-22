"use client";

import { useMemo, useRef, useState } from "react";
import { CheckCircle2, FileSpreadsheet, Loader2, Send, SlidersHorizontal, Trash2, Upload, Users } from "lucide-react";
import { SearchSelect } from "@/components/admin/SearchSelect";
import { createCampaign, parseCampaignExcelAction } from "@/lib/actions/whatsapp-inbox";
import type {
  CampaignRecipient,
  CampaignSourceMode,
  TemplateVarBinding,
  TemplateVarSource,
} from "@/lib/whatsapp/campaigns";
import type { MetaApprovedTemplate } from "@/lib/whatsapp/kwingo-bridge";

const field =
  "w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-navy outline-none focus:border-ia focus:ring-4 focus:ring-ia/10";

const VAR_SOURCE_OPTIONS: { value: TemplateVarSource; label: string; group: string }[] = [
  { value: "PRENOM", label: "Prénom du consultant / client", group: "Attributs destinataire" },
  { value: "NOM", label: "Nom complet du destinataire", group: "Attributs destinataire" },
  { value: "VILLE", label: "Ville du consultant", group: "Attributs destinataire" },
  { value: "BOUTIQUE", label: "Nom de la boutique du consultant", group: "Attributs destinataire" },
  { value: "LIEN_BOUTIQUE", label: "Lien boutique (/c/slug)", group: "Attributs destinataire" },
  { value: "CONSULTANT", label: "Nom du parrain / consultant rattaché", group: "Attributs destinataire" },
  { value: "TELEPHONE", label: "Numéro WhatsApp", group: "Attributs destinataire" },
  { value: "DATE_JOUR", label: "Date du jour (automatique)", group: "Paramètres temporels" },
  { value: "MOIS_COURANT", label: "Mois en cours (automatique)", group: "Paramètres temporels" },
  { value: "DATE_FIXE", label: "Date précise (calendrier)", group: "Paramètre fixe campagne" },
  { value: "TEXTE_FIXE", label: "Texte fixe libre (heure, lieu, promo…)", group: "Paramètre fixe campagne" },
];

function formatDateFr(raw?: string): string {
  const s = (raw ?? "").trim();
  if (!s) return new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  }
  return s;
}

function buildDefaultBindings(tpl: MetaApprovedTemplate): TemplateVarBinding[] {
  const count = tpl.paramCount ?? 0;
  if (count <= 0) return [];
  return Array.from({ length: count }, (_, idx) => {
    if (idx === 0) return { source: "PRENOM" };
    return {
      source: "TEXTE_FIXE",
      value: tpl.exampleParams?.[idx] || "",
    };
  });
}

function resolvePreviewVars(bindings: TemplateVarBinding[], sample?: CampaignRecipient): string[] {
  const name = (sample?.name ?? "Awa Diop").trim();
  const first = name.split(/\s+/)[0] || "Awa";
  return bindings.map((b) => {
    switch (b.source) {
      case "PRENOM":
        return first;
      case "NOM":
        return name;
      case "TELEPHONE":
        return sample?.phone ? `+${sample.phone.replace(/^\+/, "")}` : "+221770000000";
      case "VILLE":
        return sample?.city || "Dakar";
      case "BOUTIQUE":
        return sample?.shopName || name;
      case "LIEN_BOUTIQUE":
        return sample?.slug ? `https://www.jamaal.sn/c/${sample.slug}` : "https://www.jamaal.sn";
      case "CONSULTANT":
        return sample?.consultantName || "JAMAAL Luxury";
      case "DATE_JOUR":
        return new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
      case "MOIS_COURANT":
        return new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
      case "DATE_FIXE":
        return formatDateFr(b.value);
      case "TEXTE_FIXE":
      default:
        return (b.value ?? "").trim() || "—";
    }
  });
}

function phoneTail9(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 9 ? digits.slice(-9) : digits;
}

function personalizePreview(body: string, name: string, resolvedVars?: string[]): string {
  let out = body;
  if (resolvedVars && resolvedVars.length > 0) {
    resolvedVars.forEach((val, idx) => {
      out = out.replace(new RegExp(`\\{\\{${idx + 1}\\}\\}`, "g"), val);
    });
  }
  const first = name.trim().split(/\s+/)[0] || "Client";
  return out
    .replace(/\{prenom\}/gi, first)
    .replace(/\{\{1\}\}/g, first)
    .replace(/\{nom\}/gi, name.trim() || "Client")
    .replace(/[ \t]+([,.])/g, "$1")
    .trim();
}

export interface WhatsAppCampaignBuilderProps {
  metaTemplates: MetaApprovedTemplate[];
  categories: { slug: string; label: string }[];
  consultants: { id: string; name: string; city: string | null }[];
  filteredRecipients: CampaignRecipient[];
  initialAudience: {
    target: "CLIENTS" | "REVENDEURS";
    inactiveDays: number;
    category: string;
    consultantId: string;
    ctaLabel: string;
    ctaUrl: string;
  };
  initialTemplateName?: string;
  initialTemplateLanguage?: string;
  initialTemplateVarBindings?: TemplateVarBinding[];
  initialBody?: string;
  initialTitle?: string;
  initialSourceMode?: CampaignSourceMode;
  initialExcelRecipients?: CampaignRecipient[];
  initialExcelFileName?: string;
  editingDraftId?: string;
}

export function WhatsAppCampaignBuilder({
  metaTemplates,
  categories,
  consultants,
  filteredRecipients,
  initialAudience,
  initialTemplateName,
  initialTemplateLanguage,
  initialTemplateVarBindings,
  initialBody,
  initialTitle = "",
  initialSourceMode = "FILTRES",
  initialExcelRecipients = [],
  initialExcelFileName = "",
  editingDraftId,
}: WhatsAppCampaignBuilderProps) {
  const defaultTemplate: MetaApprovedTemplate =
    metaTemplates.find((t) => t.templateName === initialTemplateName) ??
    metaTemplates.find((t) => t.language.startsWith("fr")) ??
    metaTemplates[0] ?? {
      id: "meta:test_lancement_produit:fr",
      title: "test_lancement_produit · MARKETING (fr)",
      templateName: "test_lancement_produit",
      language: "fr",
      category: "MARKETING",
      text: "Bonjour {prenom}, nous vous invitons au lancement du nouveau parfum KiKi n44 qui aura lieu le 7 novembre 2026 à 15h00 au Radisson",
      rawBody:
        "Bonjour {{1}}, nous vous invitons au lancement du nouveau parfum KiKi n44 qui aura lieu le {{2}} à {{3}} au Radisson",
      isMetaApproved: true as const,
      paramCount: 3,
      exampleParams: ["Macoumba", "7 novembre 2026", "15h00"],
    };

  const [selectedTemplate, setSelectedTemplate] = useState<MetaApprovedTemplate>({
    ...defaultTemplate,
    language: initialTemplateLanguage || defaultTemplate.language,
  });

  const [varBindings, setVarBindings] = useState<TemplateVarBinding[]>(() =>
    initialTemplateVarBindings && initialTemplateVarBindings.length > 0
      ? initialTemplateVarBindings
      : buildDefaultBindings(defaultTemplate),
  );

  const [body, setBody] = useState<string>(initialBody || defaultTemplate.rawBody || defaultTemplate.text);
  const [title, setTitle] = useState<string>(initialTitle);
  const [ctaLabel, setCtaLabel] = useState<string>(initialAudience.ctaLabel);
  const [ctaUrl, setCtaUrl] = useState<string>(initialAudience.ctaUrl);

  // État pour l'import de liste Excel / CSV
  const [sourceMode, setSourceMode] = useState<CampaignSourceMode>(initialSourceMode);
  const [excelRecipients, setExcelRecipients] = useState<CampaignRecipient[]>(initialExcelRecipients);
  const [excelFileName, setExcelFileName] = useState<string>(initialExcelFileName);
  const [excelStats, setExcelStats] = useState<{
    rawCount: number;
    skippedInvalid: number;
    excludedOptOut: number;
  } | null>(null);
  const [uploadingExcel, setUploadingExcel] = useState<boolean>(false);
  const [excelError, setExcelError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleExcelFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingExcel(true);
    setExcelError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (initialAudience.consultantId) {
        fd.append("consultantId", initialAudience.consultantId);
      }
      const res = await parseCampaignExcelAction(fd);
      if (!res.ok || !res.recipients) {
        setExcelError(res.error || "Impossible d'analyser ce fichier Excel.");
      } else {
        setExcelRecipients(res.recipients);
        setExcelFileName(res.fileName || file.name);
        setExcelStats({
          rawCount: res.rawCount ?? res.recipients.length,
          skippedInvalid: res.skippedInvalid ?? 0,
          excludedOptOut: res.excludedOptOut ?? 0,
        });
        if (sourceMode === "FILTRES") {
          setSourceMode(filteredRecipients.length > 0 ? "FILTRES_ET_EXCEL" : "EXCEL");
        }
      }
    } catch {
      setExcelError("Erreur lors de la lecture du fichier Excel.");
    } finally {
      setUploadingExcel(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleClearExcel() {
    setExcelRecipients([]);
    setExcelFileName("");
    setExcelStats(null);
    setExcelError(null);
    setSourceMode("FILTRES");
  }

  function handleRemoveExcelRecipient(phone: string) {
    setExcelRecipients((prev) => {
      const next = prev.filter((r) => r.phone !== phone);
      if (next.length === 0) setSourceMode("FILTRES");
      return next;
    });
  }

  // Liste consolidée et dédoublonnée (base filtrée et/ou liste Excel)
  const finalRecipients = useMemo(() => {
    const baseList =
      sourceMode === "EXCEL"
        ? []
        : filteredRecipients.map((r) => ({ ...r, source: "BASE" as const }));
    const excelList =
      sourceMode === "FILTRES" && excelRecipients.length === 0
        ? []
        : sourceMode === "FILTRES"
          ? []
          : excelRecipients.map((r) => ({ ...r, source: "EXCEL" as const }));

    const combined = [...baseList, ...excelList];
    const seen = new Set<string>();
    return combined.filter((r) => {
      const t = phoneTail9(r.phone);
      if (!t || seen.has(t)) return false;
      seen.add(t);
      return true;
    });
  }, [sourceMode, filteredRecipients, excelRecipients]);

  const assignedCount = useMemo(
    () => finalRecipients.filter((r) => Boolean(r.consultantId)).length,
    [finalRecipients],
  );
  const unassignedCount = finalRecipients.length - assignedCount;

  const sampleRecipientName = finalRecipients[0]?.name ?? "Awa Diop";

  return (
    <div className="space-y-6">
      {/* ÉTAPE 1 : Choix du modèle approuvé par Meta */}
      <section className="rounded-2xl border border-line bg-white p-5 shadow-2xs">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#1f9d55] border border-emerald-200">
              Étape 1 · Obligatoire API Cloud
            </span>
            <h2 className="mt-1.5 font-serif-display text-lg font-semibold text-navy">
              1. Choisir un modèle approuvé par Meta
            </h2>
            <p className="mt-0.5 text-xs text-navy/65">
              Sélectionnez le modèle officiel validé par Meta sur le compte WhatsApp Business{" "}
              <strong>JAMAAL Luxury (+221 71 180 09 09)</strong>.
            </p>
          </div>
          <span className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-1.5 text-xs font-semibold text-emerald-900">
            Modèle actif : <code>{selectedTemplate.templateName}</code> ({selectedTemplate.language})
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {metaTemplates.map((tpl) => {
            const isSelected =
              selectedTemplate.templateName === tpl.templateName &&
              selectedTemplate.language === tpl.language;
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => {
                  setSelectedTemplate(tpl);
                  setVarBindings(buildDefaultBindings(tpl));
                  setBody(tpl.rawBody || tpl.text);
                }}
                className={`flex flex-col justify-between rounded-2xl border p-3.5 text-left transition ${
                  isSelected
                    ? "border-[#25D366] bg-emerald-50/60 ring-2 ring-[#25D366]/20"
                    : "border-line bg-white hover:border-[#25D366]/60"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-sm font-bold text-navy">
                      {isSelected && <CheckCircle2 size={15} className="text-[#1f9d55]" />}
                      {tpl.templateName}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="rounded-full bg-cream px-2 py-0.5 text-[10px] font-semibold uppercase text-navy/75">
                        {tpl.category} · {tpl.language}
                      </span>
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-[#1f9d55]">
                        ✓ Approuvé Meta
                      </span>
                    </div>
                  </div>
                  <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-navy/75">{tpl.text}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Association dynamique des variables {{1}}, {{2}}, {{3}}… du modèle Meta */}
        {varBindings.length > 0 && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#1f9d55]">
                <SlidersHorizontal size={14} />
                Association des variables du modèle ({varBindings.length} variable{varBindings.length > 1 ? "s" : ""})
              </p>
              <span className="text-[11px] text-navy/65">
                Liez chaque variable <code>{"{{1}}"}</code>, <code>{"{{2}}"}</code>… à un attribut du consultant ou à une date/valeur fixe.
              </span>
            </div>

            <div className="mt-3 space-y-2.5">
              {varBindings.map((binding, idx) => (
                <div
                  key={idx}
                  className="grid items-center gap-2.5 rounded-xl border border-emerald-200/80 bg-white p-2.5 sm:grid-cols-[5.5rem_1fr_1fr]"
                >
                  <span className="inline-flex items-center justify-center rounded-lg bg-navy px-2.5 py-1.5 font-mono text-xs font-bold text-white">
                    {`{{${idx + 1}}}`}
                  </span>

                  <select
                    aria-label={`Source pour la variable {{${idx + 1}}}`}
                    value={binding.source}
                    onChange={(e) => {
                      const nextSrc = e.target.value as TemplateVarSource;
                      setVarBindings((prev) =>
                        prev.map((item, i) =>
                          i === idx
                            ? {
                                source: nextSrc,
                                value:
                                  nextSrc === "DATE_FIXE"
                                    ? item.value && /^\d{4}-\d{2}-\d{2}$/.test(item.value)
                                      ? item.value
                                      : new Date().toISOString().slice(0, 10)
                                    : nextSrc === "TEXTE_FIXE"
                                      ? item.value || selectedTemplate.exampleParams?.[idx] || ""
                                      : undefined,
                              }
                            : item,
                        ),
                      );
                    }}
                    className={field}
                  >
                    {VAR_SOURCE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>

                  {binding.source === "DATE_FIXE" ? (
                    <input
                      type="date"
                      value={binding.value ?? ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setVarBindings((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, value: val } : item)),
                        );
                      }}
                      className={field}
                    />
                  ) : binding.source === "TEXTE_FIXE" ? (
                    <input
                      type="text"
                      maxLength={200}
                      value={binding.value ?? ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setVarBindings((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, value: val } : item)),
                        );
                      }}
                      placeholder={selectedTemplate.exampleParams?.[idx] || "Ex. 15h00, Radisson Blu…"}
                      className={field}
                    />
                  ) : (
                    <div className="rounded-xl bg-cream/60 px-3 py-2 text-xs text-navy/75">
                      Aperçu :{" "}
                      <strong className="text-navy">
                        {resolvePreviewVars([binding], finalRecipients[0])[0]}
                      </strong>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium text-navy sm:col-span-2">
            Texte personnalisé du modèle (<code>{"{prenom}"}</code> est remplacé par le prénom de chaque destinataire)
            <textarea
              rows={3}
              maxLength={1000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className={`mt-1 ${field}`}
            />
          </label>
          <label className="text-sm text-navy">
            Bouton d&apos;action facultatif (texte, 20 caractères max)
            <input
              maxLength={20}
              value={ctaLabel}
              onChange={(e) => setCtaLabel(e.target.value)}
              placeholder="Voir l'offre"
              className={`mt-1 ${field}`}
            />
          </label>
          <label className="text-sm text-navy">
            Lien du bouton (https://…)
            <input
              value={ctaUrl}
              onChange={(e) => setCtaUrl(e.target.value)}
              placeholder="https://www.jamaal.sn/offres"
              className={`mt-1 ${field}`}
            />
          </label>
        </div>
      </section>

      {/* ÉTAPE 2 : Sélection des destinataires (Filtres en place + Upload Excel) */}
      <section className="rounded-2xl border border-line bg-white p-5 shadow-2xs">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-cream px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-navy/75">
              Étape 2 · Ciblage & Import Excel
            </span>
            <h2 className="mt-1.5 font-serif-display text-lg font-semibold text-navy">
              2. Sélectionner les destinataires (Filtres ou Liste Excel)
            </h2>
            <p className="mt-0.5 text-xs text-navy/65">
              Filtrez les clients/revendeurs de la base JAMAAL et/ou téléversez un fichier Excel (<code>.xlsx</code>, <code>.csv</code>). Les personnes ayant répondu STOP sont automatiquement exclues.
            </p>
          </div>
        </div>

        {/* Sous-bloc 2A : Filtres déjà en place */}
        <div className="mt-4 rounded-xl border border-line bg-cream/30 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wider text-navy">
              A. Filtres de la base JAMAAL ({filteredRecipients.length} destinataire{filteredRecipients.length > 1 ? "s" : ""} trouvé{filteredRecipients.length > 1 ? "s" : ""})
            </p>
          </div>

          <form method="GET" action="/admin/whatsapp/campagnes" className="mt-3 grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="templateName" value={selectedTemplate.templateName} />
            <input type="hidden" name="templateLanguage" value={selectedTemplate.language} />
            <input type="hidden" name="body" value={body} />
            <input type="hidden" name="title" value={title} />
            <input type="hidden" name="ctaLabel" value={ctaLabel} />
            <input type="hidden" name="ctaUrl" value={ctaUrl} />

            <label className="text-sm text-navy">
              Destinataires
              <select name="target" defaultValue={initialAudience.target} className={`mt-1 ${field}`}>
                <option value="CLIENTS">Clients</option>
                <option value="REVENDEURS">Revendeurs actifs</option>
              </select>
            </label>

            <label className="text-sm text-navy">
              Clients sans commande depuis (jours, 0 = tous)
              <input
                name="inactiveDays"
                type="number"
                min={0}
                max={3650}
                defaultValue={initialAudience.inactiveDays}
                className={`mt-1 ${field}`}
              />
            </label>

            <div className="text-sm text-navy">
              Ont acheté dans la catégorie
              <SearchSelect
                name="category"
                defaultValue={initialAudience.category}
                emptyLabel="Toutes les catégories"
                placeholder="Rechercher une catégorie…"
                options={categories.map((c) => ({ value: c.slug, label: c.label }))}
                className="mt-1"
              />
            </div>

            <div className="text-sm text-navy">
              Clients du revendeur
              <SearchSelect
                name="consultantId"
                defaultValue={initialAudience.consultantId}
                emptyLabel="Tous les revendeurs"
                placeholder="Rechercher un revendeur par nom…"
                options={consultants.map((c) => ({
                  value: c.id,
                  label: c.name,
                  hint: c.city ?? undefined,
                }))}
                className="mt-1"
              />
            </div>

            <div className="sm:col-span-2 flex items-center justify-between gap-3 pt-1">
              <p className="text-xs text-navy/65">
                Cliquez pour mettre à jour la liste issue des filtres de la base.
              </p>
              <button
                type="submit"
                className="rounded-full border border-ia bg-white px-4 py-2 text-xs font-semibold text-ia-dark hover:bg-ia-light/40"
              >
                Appliquer les filtres ({filteredRecipients.length})
              </button>
            </div>
          </form>
        </div>

        {/* Sous-bloc 2B : Upload d'une liste Excel / CSV de destinataires */}
        <div className="mt-4 rounded-xl border border-line bg-cream/30 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-navy">
                <FileSpreadsheet size={15} className="text-[#1f9d55]" />
                B. Importer une liste Excel (.xlsx) ou CSV (.csv) de destinataires
              </p>
              <p className="mt-0.5 text-xs text-navy/65">
                Colonnes reconnues automatiquement : <strong>Téléphone / WhatsApp / Numéro</strong>, et optionnellement{" "}
                <strong>Nom / Prénom</strong> et <strong>Consultant / Parrain</strong>.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.txt"
                onChange={handleExcelFileChange}
                className="hidden"
                id="campaign-excel-upload"
              />
              <label
                htmlFor="campaign-excel-upload"
                className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-navy px-4 py-2 text-xs font-semibold text-white transition hover:bg-navy/90"
              >
                {uploadingExcel ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                <span>{excelRecipients.length > 0 ? "Remplacer le fichier Excel" : "Téléverser un fichier Excel / CSV"}</span>
              </label>
              {excelRecipients.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearExcel}
                  className="inline-flex items-center gap-1 rounded-full border border-rose/30 bg-white px-3 py-2 text-xs font-semibold text-rose-dark hover:bg-rose/10"
                >
                  <Trash2 size={13} /> Retirer la liste
                </button>
              )}
            </div>
          </div>

          {excelError && (
            <p className="mt-3 rounded-xl border border-rose/20 bg-rose/10 px-3.5 py-2 text-xs font-medium text-rose-dark">
              {excelError}
            </p>
          )}

          {excelRecipients.length > 0 && (
            <div className="mt-3 space-y-3 rounded-xl border border-emerald-200 bg-white p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-navy">
                    Fichier importé : <span className="text-[#1f9d55]">{excelFileName}</span> —{" "}
                    <strong>{excelRecipients.length}</strong> numéro{excelRecipients.length > 1 ? "s" : ""} WhatsApp valide{excelRecipients.length > 1 ? "s" : ""}
                  </p>
                  {excelStats && (
                    <p className="text-[11px] text-navy/60">
                      {excelStats.rawCount} ligne(s) lue(s)
                      {excelStats.skippedInvalid > 0 ? ` · ${excelStats.skippedInvalid} numéro(s) invalide(s) ignoré(s)` : ""}
                      {excelStats.excludedOptOut > 0 ? ` · ${excelStats.excludedOptOut} client(s) STOP exclu(s)` : ""}
                    </p>
                  )}
                </div>

                {/* Choix du mode de source : uniquement Excel, ou Filtres + Excel */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSourceMode("EXCEL")}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                      sourceMode === "EXCEL"
                        ? "bg-navy text-white"
                        : "border border-line bg-cream/60 text-navy hover:bg-cream"
                    }`}
                  >
                    Uniquement la liste Excel ({excelRecipients.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSourceMode("FILTRES_ET_EXCEL")}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                      sourceMode === "FILTRES_ET_EXCEL"
                        ? "bg-navy text-white"
                        : "border border-line bg-cream/60 text-navy hover:bg-cream"
                    }`}
                  >
                    Combiner Filtres + Excel
                  </button>
                  <button
                    type="button"
                    onClick={() => setSourceMode("FILTRES")}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                      sourceMode === "FILTRES"
                        ? "bg-navy text-white"
                        : "border border-line bg-cream/60 text-navy hover:bg-cream"
                    }`}
                  >
                    Uniquement les filtres ({filteredRecipients.length})
                  </button>
                </div>
              </div>

              {/* Aperçu des destinataires Excel importés */}
              <div className="max-h-44 overflow-y-auto rounded-lg border border-line">
                <table className="w-full text-left text-xs">
                  <thead className="bg-cream text-[11px] uppercase text-navy/70">
                    <tr>
                      <th className="px-3 py-2">Destinataire</th>
                      <th className="px-3 py-2">Numéro WhatsApp</th>
                      <th className="px-3 py-2">Routage retour KwingoChat</th>
                      <th className="px-3 py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/60">
                    {excelRecipients.slice(0, 50).map((r) => (
                      <tr key={r.phone} className="hover:bg-cream/40">
                        <td className="px-3 py-1.5 font-medium text-navy">{r.name}</td>
                        <td className="px-3 py-1.5 font-mono text-navy/75">+{r.phone}</td>
                        <td className="px-3 py-1.5">
                          {r.consultantName || r.consultantId ? (
                            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-800">
                              {r.consultantName || "Consultant assigné"}
                            </span>
                          ) : (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                              unassigned
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveExcelRecipient(r.phone)}
                            className="text-navy/45 hover:text-rose-dark"
                            title="Retirer ce destinataire"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {excelRecipients.length > 50 && (
                  <p className="bg-cream/40 px-3 py-1.5 text-center text-[11px] text-navy/60">
                    + {excelRecipients.length - 50} autre(s) destinataire(s) importé(s)…
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ÉTAPE 3 : Aperçu WhatsApp & Envoi de la campagne */}
      <section className="rounded-2xl border border-line bg-white p-5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#1f9d55] border border-emerald-200">
              Étape 3 · Validation & Envoi API Cloud
            </span>
            <h2 className="mt-1.5 font-serif-display text-lg font-semibold text-navy">
              3. Aperçu et lancement de la campagne
            </h2>
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-cream/60 px-3.5 py-2 text-xs text-navy">
            <Users size={15} className="text-navy" />
            <span>
              Total consolidé : <strong>{finalRecipients.length}</strong> destinataire
              {finalRecipients.length > 1 ? "s" : ""} unique{finalRecipients.length > 1 ? "s" : ""}
            </span>
          </div>
        </div>

        <p className="mt-2 text-sm text-navy">
          <strong>{finalRecipients.length}</strong> destinataire{finalRecipients.length > 1 ? "s" : ""} sélectionné
          {finalRecipients.length > 1 ? "s" : ""}
          {finalRecipients.length > 0
            ? ` (ex. ${finalRecipients
                .slice(0, 4)
                .map((r) => `${r.name} (+${r.phone})`)
                .join(", ")}${finalRecipients.length > 4 ? "…" : ""})`
            : "."}
        </p>

        {finalRecipients.length > 0 && (
          <p className="mt-1 text-xs text-navy/70">
            Routage automatique des retours KwingoChat : <strong>{assignedCount}</strong> rattaché(s) à un consultant
            (retours auto-assignés dans son Inbox) · <strong>{unassignedCount}</strong> sans consultant (
            <code className="rounded bg-cream px-1 py-0.5">unassigned</code>).
          </p>
        )}

        {/* Bulle d'aperçu WhatsApp */}
        <div className="mt-4 max-w-md rounded-2xl bg-[#efeae2] p-4">
          <div className="mb-2 flex items-center justify-between text-[11px] font-semibold text-navy/65">
            <span>Aperçu client ({sampleRecipientName})</span>
            <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-[#1f9d55]">
              Modèle Meta : {selectedTemplate.templateName} ({selectedTemplate.language})
            </span>
          </div>
          <div className="whitespace-pre-wrap rounded-xl bg-[#d9fdd3] px-4 py-3 text-sm text-navy shadow-2xs">
            {personalizePreview(
              body,
              sampleRecipientName,
              varBindings.length > 0 ? resolvePreviewVars(varBindings, finalRecipients[0]) : undefined,
            )}
            {ctaUrl && /^https:\/\//.test(ctaUrl.trim()) && (
              <span className="mt-2 block border-t border-navy/10 pt-2 text-center font-semibold text-[#0a7cff]">
                {ctaLabel.trim() || "Voir"}
              </span>
            )}
          </div>
        </div>

        {/* Formulaire final d'enregistrement en brouillon(s) / envoi */}
        <form action={createCampaign} className="mt-5 space-y-3">
          <input type="hidden" name="draftId" value={editingDraftId ?? ""} />
          <input type="hidden" name="target" value={initialAudience.target} />
          <input type="hidden" name="inactiveDays" value={String(initialAudience.inactiveDays)} />
          <input type="hidden" name="category" value={initialAudience.category} />
          <input type="hidden" name="consultantId" value={initialAudience.consultantId} />
          <input type="hidden" name="ctaLabel" value={ctaLabel} />
          <input type="hidden" name="ctaUrl" value={ctaUrl} />
          <input type="hidden" name="body" value={body} />
          <input type="hidden" name="templateName" value={selectedTemplate.templateName} />
          <input type="hidden" name="templateLanguage" value={selectedTemplate.language} />
          <input type="hidden" name="templateVarBindingsJson" value={JSON.stringify(varBindings)} />
          <input type="hidden" name="sourceMode" value={sourceMode} />
          <input type="hidden" name="excelFileName" value={excelFileName} />
          <input type="hidden" name="excelRecipientsJson" value={JSON.stringify(excelRecipients)} />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              name="title"
              required
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nom de la campagne ou du brouillon (ex. Lancement KiKi n°44 — Lot VIP)"
              className={`flex-1 ${field}`}
            />

            <div className="flex flex-wrap items-center gap-2">
              {editingDraftId && (
                <button
                  name="send"
                  value="update"
                  className="rounded-full border border-navy bg-navy/5 px-4 py-2.5 text-xs font-semibold text-navy hover:bg-navy/10"
                >
                  Mettre à jour ce brouillon
                </button>
              )}
              <button
                name="send"
                value="0"
                className="rounded-full border border-line bg-white px-5 py-2.5 text-xs font-semibold text-navy hover:bg-cream"
              >
                {editingDraftId ? "+ Enregistrer comme nouveau brouillon" : "+ Enregistrer en brouillon"}
              </button>
              <button
                name="send"
                value="1"
                disabled={finalRecipients.length === 0 || !selectedTemplate.templateName}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#25D366] px-5 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-[#1ebe5b] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send size={14} />
                <span>Lancer maintenant ({finalRecipients.length})</span>
              </button>
            </div>
          </div>
        </form>

        <p className="mt-2 text-xs text-navy/55">
          Envoi via l&apos;API Cloud WhatsApp JAMAAL Luxury (+221 71 180 09 09) avec le modèle Meta sélectionné. Envoi par lots d&apos;environ 45 secondes : pour une grande liste, cliquez « Continuer » dans l&apos;historique jusqu&apos;à « Envoyée ».
        </p>
      </section>
    </div>
  );
}
