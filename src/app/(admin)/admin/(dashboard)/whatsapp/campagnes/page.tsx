import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/actions/auth-guard";
import { continueCampaign, createCampaign } from "@/lib/actions/whatsapp-inbox";
import { campaignRecipients, parseAudience, personalize } from "@/lib/whatsapp/campaigns";
import { whatsappConfig } from "@/lib/whatsapp";
import { SearchSelect } from "@/components/admin/SearchSelect";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const field = "w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-ia focus:ring-4 focus:ring-ia/10";
const STATUS: Record<string, string> = { BROUILLON: "Brouillon", EN_COURS: "En cours", ENVOYEE: "Envoyée" };

type SP = { target?: string; inactiveDays?: string; category?: string; consultantId?: string; body?: string; title?: string; ctaLabel?: string; ctaUrl?: string; erreur?: string; c?: string };

export default async function CampagnesPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireAdmin("whatsapp", "read");
  const sp = await searchParams;
  const audience = parseAudience({ target: sp.target, inactiveDays: sp.inactiveDays, category: sp.category, consultantId: sp.consultantId, cta: { label: sp.ctaLabel, url: sp.ctaUrl } });
  const [categories, consultants, campaigns, recipients] = await Promise.all([
    prisma.category.findMany({ orderBy: { position: "asc" }, select: { slug: true, label: true } }),
    prisma.consultant.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, city: true } }),
    prisma.whatsAppCampaign.findMany({ orderBy: { createdAt: "desc" }, take: 30 }).catch(() => null),
    campaignRecipients(audience).catch(() => []),
  ]);
  const body = sp.body ?? "Bonjour {prenom} ✨ ";
  const cfg = whatsappConfig();

  return (
    <div className="max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif-display text-2xl font-semibold text-navy">Campagnes WhatsApp</h1>
          <p className="mt-1 text-sm text-navy/75">Un message personnalisé à une liste ciblée : clients inactifs, acheteurs d&apos;une gamme, clients d&apos;un revendeur, ou tous les revendeurs. Les clients ayant répondu STOP sont exclus.</p>
        </div>
        <Link href="/admin/whatsapp/conversations" className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-navy hover:bg-cream">Conversations</Link>
      </div>
      {!cfg.active && <p className="mt-4 rounded-xl bg-amber-50 px-4 py-2 text-sm text-amber-800">Mode simulation : les messages seront enregistrés dans le journal sans être envoyés tant que WhatsApp n&apos;est pas branché.</p>}
      {cfg.active && !cfg.template && <p className="mt-4 rounded-xl bg-amber-50 px-4 py-2 text-sm text-amber-800">Aucun modèle validé (WHATSAPP_TEMPLATE_NAME) : Meta refusera les messages aux personnes qui n&apos;ont pas écrit dans les 24 h.</p>}
      {sp.erreur && <p className="mt-4 rounded-xl bg-rose/10 px-4 py-2 text-sm text-rose-dark">{sp.erreur}</p>}

      <section className="mt-6 rounded-2xl border border-line bg-white p-5">
        <h2 className="font-serif-display text-lg font-semibold text-navy">1. Audience et message</h2>
        <form className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-navy">Destinataires
            <select name="target" defaultValue={audience.target} className={field}>
              <option value="CLIENTS">Clients</option>
              <option value="REVENDEURS">Revendeurs actifs</option>
            </select>
          </label>
          <label className="text-sm text-navy">Clients sans commande depuis (jours, 0 = tous)
            <input name="inactiveDays" type="number" min={0} max={3650} defaultValue={audience.inactiveDays ?? 0} className={field} />
          </label>
          <div className="text-sm text-navy">Ont acheté dans la catégorie
            <SearchSelect name="category" defaultValue={audience.category ?? ""} emptyLabel="Toutes les catégories" placeholder="Rechercher une catégorie…" options={categories.map((c) => ({ value: c.slug, label: c.label }))} className="mt-1" />
          </div>
          <div className="text-sm text-navy">Clients du revendeur
            <SearchSelect name="consultantId" defaultValue={audience.consultantId ?? ""} emptyLabel="Tous les revendeurs" placeholder="Rechercher un revendeur par nom…" options={consultants.map((c) => ({ value: c.id, label: c.name, hint: c.city ?? undefined }))} className="mt-1" />
          </div>
          <label className="text-sm text-navy sm:col-span-2">Message ({"{prenom}"} est remplacé par le prénom)
            <textarea name="body" rows={4} maxLength={1000} defaultValue={body} className={field} />
          </label>
          <label className="text-sm text-navy">Bouton (texte, 20 caractères)
            <input name="ctaLabel" maxLength={20} defaultValue={sp.ctaLabel ?? ""} placeholder="Voir l'offre" className={field} />
          </label>
          <label className="text-sm text-navy">Lien du bouton (https://…)
            <input name="ctaUrl" defaultValue={sp.ctaUrl ?? ""} placeholder="https://…/offres/tabaski" className={field} />
          </label>
          <input type="hidden" name="title" value={sp.title ?? ""} />
          <div className="sm:col-span-2">
            <button className="rounded-full border border-ia px-5 py-2 text-sm font-semibold text-ia-dark hover:bg-ia-light/40">Calculer l&apos;audience et l&apos;aperçu</button>
          </div>
        </form>
      </section>

      <section className="mt-6 rounded-2xl border border-line bg-white p-5">
        <h2 className="font-serif-display text-lg font-semibold text-navy">2. Aperçu et envoi</h2>
        <p className="mt-2 text-sm text-navy">
          <strong>{recipients.length}</strong> destinataire{recipients.length > 1 ? "s" : ""}{recipients.length ? ` (ex. ${recipients.slice(0, 3).map((r) => r.name).join(", ")}${recipients.length > 3 ? "…" : ""})` : ""}.
        </p>
        <div className="mt-3 max-w-md whitespace-pre-wrap rounded-xl bg-[#d9fdd3] px-4 py-3 text-sm text-navy shadow-sm">
          {personalize(body, recipients[0]?.name ?? "Awa Diop")}
          {audience.cta && <span className="mt-2 block border-t border-navy/10 pt-2 text-center font-semibold text-[#0a7cff]">{audience.cta.label}</span>}
        </div>
        <form action={createCampaign} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          {(["target", "inactiveDays", "category", "consultantId", "ctaLabel", "ctaUrl"] as const).map((k) => (
            <input key={k} type="hidden" name={k} value={k === "target" ? audience.target : k === "inactiveDays" ? String(audience.inactiveDays ?? 0) : k === "ctaLabel" ? audience.cta?.label ?? "" : k === "ctaUrl" ? audience.cta?.url ?? "" : (audience[k] ?? "")} />
          ))}
          <input type="hidden" name="body" value={body} />
          <input name="title" required maxLength={120} defaultValue={sp.title ?? ""} placeholder="Nom de la campagne (ex. Relance Tabaski)" className={field} />
          <button name="send" value="0" className="rounded-full border border-line px-5 py-2 text-sm font-semibold text-navy hover:bg-cream">Enregistrer</button>
          <button name="send" value="1" disabled={!recipients.length} className="rounded-full bg-[#25D366] px-5 py-2 text-sm font-semibold text-white hover:bg-[#1ebe5b] disabled:opacity-50">Envoyer à {recipients.length}</button>
        </form>
        <p className="mt-2 text-xs text-navy/55">Envoi par lots d&apos;environ 45 secondes : pour une grande liste, cliquez « Continuer » dans l&apos;historique jusqu&apos;à « Envoyée ». Personne ne reçoit le message deux fois.</p>
      </section>

      <section className="mt-6 overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full text-sm">
          <thead className="bg-cream text-left text-xs uppercase text-navy/70">
            <tr><th className="px-4 py-3">Campagne</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Statut</th><th className="px-4 py-3">Envoyés</th><th className="px-4 py-3">Échecs</th><th className="px-4 py-3"></th></tr>
          </thead>
          <tbody>
            {(campaigns ?? []).map((c) => (
              <tr key={c.id} className={`border-t border-line ${sp.c === c.id ? "bg-ia-light/30" : ""}`}>
                <td className="px-4 py-3"><p className="font-semibold text-navy">{c.title}</p><p className="max-w-xs truncate text-xs text-navy/60">{c.body}</p></td>
                <td className="whitespace-nowrap px-4 py-3 text-xs">{(c.sentAt ?? c.createdAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</td>
                <td className="px-4 py-3 text-xs">{STATUS[c.status] ?? c.status}</td>
                <td className="px-4 py-3 text-xs">{c.sent} / {c.total}</td>
                <td className="px-4 py-3 text-xs">{c.failed}</td>
                <td className="px-4 py-3 text-right">
                  {c.status !== "ENVOYEE" && <form action={continueCampaign.bind(null, c.id)}><button className="rounded-full bg-ia px-3 py-1.5 text-xs font-semibold text-white hover:bg-ia-dark">{c.status === "BROUILLON" ? "Envoyer" : "Continuer"}</button></form>}
                </td>
              </tr>
            ))}
            {campaigns === null && <tr><td colSpan={6} className="px-4 py-8 text-center text-navy/60">Disponible après la mise à jour de la base (migration 21).</td></tr>}
            {campaigns?.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-navy/60">Aucune campagne pour le moment.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
