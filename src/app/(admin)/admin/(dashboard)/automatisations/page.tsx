import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-page-guard";
import { prisma } from "@/lib/prisma";
import { AUTOMATIONS, automationStates, type AutomationId } from "@/lib/automation-settings";
import { whatsappConfig } from "@/lib/whatsapp";
import { geminiConfigured } from "@/lib/ai/gemini";
import { AutomationToggle, RunDailyButton } from "@/components/admin/GrowthWidgets";

export const dynamic = "force-dynamic";

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
export const metadata = { title: "Automatisations" };
export const maxDuration = 60;

const PREFIX: Partial<Record<AutomationId, string>> = { relance45: "relance45:", birthday: "anniversaire:", cart: "panier:", reviews: "avis:", summary: "resume:" };

export default async function AutomationsPage() {
  await requireAdminPage();
  const since = daysAgo(30);
  const [states, sent, botIn, botOut, waOrders, carts, wa] = await Promise.all([
    automationStates(),
    prisma.automationSent.findMany({ where: { createdAt: { gte: since } }, select: { key: true } }),
    prisma.whatsAppMessage.count({ where: { direction: "IN", createdAt: { gte: since } } }),
    prisma.whatsAppMessage.count({ where: { kind: "bot", createdAt: { gte: since } } }),
    prisma.whatsAppMessage.count({ where: { kind: "bot", body: { contains: "/commande/" }, createdAt: { gte: since } } }),
    prisma.abandonedCart.findMany({ orderBy: { updatedAt: "desc" }, take: 8, select: { id: true, name: true, phone: true, total: true, updatedAt: true, remindedAt: true, orderedAt: true } }),
    Promise.resolve(whatsappConfig()),
  ]);
  const count = (p?: string) => (p ? sent.filter((s) => s.key.startsWith(p)).length : null);
  const checks = [
    { ok: wa.active, label: "Envoi WhatsApp", help: wa.active ? `Actif (${wa.provider})` : "Non configuré : les messages sont simulés et notés dans le Journal WhatsApp (réglages dans Centre WhatsApp)." },
    { ok: wa.webhookReady, label: "Réception des messages WhatsApp", help: wa.webhookReady ? "Webhook prêt : l'assistant répond aux clients." : "Ajoutez WHATSAPP_VERIFY_TOKEN et WHATSAPP_APP_SECRET dans Vercel, puis déclarez /api/whatsapp/webhook chez Meta." },
    { ok: geminiConfigured(), label: "Intelligence artificielle", help: geminiConfigured() ? "Clé Gemini présente." : "Ajoutez GOOGLE_AI_API_KEY dans Vercel." },
    { ok: !!process.env.CRON_SECRET, label: "Tâche quotidienne (19 h)", help: process.env.CRON_SECRET ? "Protégée par CRON_SECRET." : "Fonctionne ; pour la sécuriser, ajoutez une variable CRON_SECRET (texte au hasard) dans Vercel." },
  ];
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[.2em] text-ia">Croissance</p>
        <h1 className="mt-1 font-serif-display text-2xl font-semibold text-navy">Automatisations</h1>
        <p className="mt-1 text-sm text-navy/75">Ce que JAMAAL fait tout seul, chaque jour à 19 h (heure de Dakar), et l&apos;assistant qui prend les commandes sur WhatsApp. Chaque envoi n&apos;a lieu qu&apos;une fois ; un client qui répond STOP n&apos;est plus contacté.</p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2">
        {checks.map((c) => (
          <div key={c.label} className={`rounded-2xl border p-4 ${c.ok ? "border-ia/30 bg-ia-light/40" : "border-amber-200 bg-amber-50"}`}>
            <p className="text-sm font-semibold text-navy">{c.ok ? "✅" : "⚠️"} {c.label}</p>
            <p className="mt-1 text-xs text-navy/75">{c.help}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-line bg-white">
        {(Object.keys(AUTOMATIONS) as AutomationId[]).map((id) => (
          <div key={id} className="flex items-center justify-between gap-4 border-b border-line p-4 last:border-0">
            <div>
              <p className="text-sm font-semibold text-navy">{AUTOMATIONS[id].label}</p>
              <p className="text-xs text-navy/70">
                {AUTOMATIONS[id].help}
                {count(PREFIX[id]) != null && <span className="ml-1 text-ia-dark">· {count(PREFIX[id])} envoi(s) sur 30 jours</span>}
                {id === "whatsappBot" && <span className="ml-1 text-ia-dark">· {botIn} message(s) reçus, {botOut} réponse(s), {waOrders} commande(s) sur 30 jours</span>}
              </p>
            </div>
            <AutomationToggle id={id} on={states[id]} label={AUTOMATIONS[id].label} />
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="font-semibold text-navy">Lancer la tâche du jour maintenant</h2>
        <p className="mb-3 mt-1 text-sm text-navy/70">Pratique pour tester : défis terminés, relances, demandes d&apos;avis, veille des prix Chogan et résumé du soir. Rien n&apos;est envoyé deux fois.</p>
        <RunDailyButton />
      </section>

      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="font-semibold text-navy">Derniers paniers commencés</h2>
        <p className="mt-1 text-sm text-navy/70">Clients qui ont saisi nom et téléphone au panier. Sans commande après 3 h, un rappel part au passage suivant de la tâche du jour.</p>
        <ul className="mt-3 divide-y divide-line text-sm">
          {carts.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="text-navy">{c.name ?? "Client"} · +{c.phone}</span>
              <span className="text-navy/70">
                {c.total.toLocaleString("fr-FR")} FCFA · {c.updatedAt.toLocaleString("fr-FR")} ·{" "}
                {c.orderedAt ? <span className="text-ia-dark">commandé</span> : c.remindedAt ? "relancé" : "en attente"}
              </span>
            </li>
          ))}
          {!carts.length && <li className="py-3 text-navy/60">Aucun panier pour le moment.</li>}
        </ul>
        <p className="mt-3 text-xs text-navy/60">
          Conversations et messages envoyés : <Link href="/admin/journal-whatsapp" className="underline">Journal WhatsApp</Link>.
        </p>
      </section>
    </div>
  );
}
