import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/actions/auth-guard";
import { whatsappConfig } from "@/lib/whatsapp";
import Link from "next/link";
import { WhatsAppTestForm } from "@/components/admin/WhatsAppTestForm";
import { WhatsAppMessagesEditor } from "@/components/admin/WhatsAppMessagesEditor";
import { getCustomMessages, MESSAGE_KEYS, WA_MESSAGES } from "@/lib/whatsapp/message-templates";
import { daysAgo, groupFailures } from "@/lib/whatsapp/diagnose";
import { AUTOMATIONS, automationStates } from "@/lib/automation-settings";
import { resendWhatsAppMessage } from "@/lib/actions/whatsapp-admin";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = {
  SIMULE: "bg-navy/10 text-navy/75",
  ENVOYE: "bg-blue-100 text-blue-800",
  LIVRE: "bg-emerald-100 text-emerald-800",
  LU: "bg-emerald-200 text-emerald-900",
  ECHEC: "bg-rose/20 text-rose-dark",
  RECU: "bg-amber-100 text-amber-800",
};
const KIND: Record<string, string> = { team: "Équipe", reseller: "Consultant", test: "Test", inbound: "Reçu", client: "Client", bot: "Assistant", relance: "Relance", avis: "Avis", resume: "Résumé", suivi: "Suivi commande", livreur: "Livreur", kit: "Kit du matin", campagne: "Campagne", conseiller: "Conseiller" };

export default async function JournalWhatsAppPage() {
  await requireAdmin("whatsapp", "read");
  const cfg = whatsappConfig();
  const since = daysAgo(7);
  const [messages, week, failures, custom, autos] = await Promise.all([
    prisma.whatsAppMessage.findMany({ orderBy: { createdAt: "desc" }, take: 100 }).catch(() => null),
    prisma.whatsAppMessage.groupBy({ by: ["status"], where: { direction: "OUT", createdAt: { gte: since } }, _count: { _all: true } }).catch(() => []),
    prisma.whatsAppMessage.findMany({ where: { direction: "OUT", status: "ECHEC", createdAt: { gte: since } }, select: { error: true, createdAt: true }, take: 500 }).catch(() => []),
    getCustomMessages(),
    automationStates().catch(() => null),
  ]);
  const count = (st: string) => week.find((w) => w.status === st)?._count._all ?? 0;
  const causes = groupFailures(failures);
  const sendingAutos = (["orderTracking", "relance45", "birthday", "cart", "reviews", "alerts", "welcome", "morningKit", "summary"] as const).map((id) => ({ id, label: AUTOMATIONS[id].label, on: autos ? autos[id] : true }));

  return (
    <div className="max-w-5xl">
      <h1 className="font-serif-display text-2xl font-semibold text-navy">Journal WhatsApp</h1>
      <p className="mt-1 text-sm text-navy/75">Messages envoyés et reçus via votre prestataire WhatsApp Business, et test de la connexion.</p>

      <section className="mt-6 rounded-2xl border border-line bg-white p-5">
        <h2 className="font-serif-display text-lg font-semibold text-navy">État de la connexion</h2>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-[12rem_1fr]">
          <dt className="text-navy/70">Prestataire</dt>
          <dd className="text-navy">{cfg.provider}</dd>
          <dt className="text-navy/70">Envoi réel</dt>
          <dd className={cfg.active ? "font-semibold text-emerald-700" : "font-semibold text-amber-700"}>
            {cfg.active ? "Activé" : "Simulation (aucun message n'est réellement envoyé)"}
          </dd>
          <dt className="text-navy/70">Modèle de message</dt>
          <dd className="text-navy">{cfg.template || "aucun (texte libre : uniquement dans les 24 h suivant un message du destinataire)"}</dd>
          <dt className="text-navy/70">Webhook (statuts, réponses)</dt>
          <dd className="text-navy">{cfg.webhookReady ? "Prêt : /api/whatsapp/webhook" : "Non configuré (WHATSAPP_VERIFY_TOKEN et WHATSAPP_APP_SECRET)"}</dd>
        </dl>
      </section>

      <section className="mt-6 rounded-2xl border border-line bg-white p-5">
        <h2 className="font-serif-display text-lg font-semibold text-navy">Envois automatiques : diagnostic des 7 derniers jours</h2>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          {([["Acceptés par Meta", count("ENVOYE") + count("LIVRE") + count("LU"), "text-navy"], ["Livrés ou lus", count("LIVRE") + count("LU"), "text-emerald-700"], ["En échec", count("ECHEC"), "text-rose-dark"], ["Simulés (non envoyés)", count("SIMULE"), "text-amber-800"]] as const).map(([l, n, c]) => (
            <div key={l} className="rounded-xl border border-line px-3 py-2"><dt className="text-xs text-navy/70">{l}</dt><dd className={`text-xl font-semibold ${c}`}>{n}</dd></div>
          ))}
        </dl>
        {!cfg.active && (
          <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
            <p className="font-semibold">Aucun message automatique ne part : WhatsApp est en mode simulation.</p>
            <p className="mt-1">Dans Vercel, renseignez WHATSAPP_PROVIDER=meta, WHATSAPP_TOKEN (jeton permanent) et WHATSAPP_PHONE_NUMBER_ID, puis redéployez.</p>
          </div>
        )}
        {cfg.active && !cfg.template && (
          <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
            <p className="font-semibold">Les messages automatiques aux clients sont refusés par Meta (aucun modèle validé).</p>
            <p className="mt-1">Hors réponse à un client dans les 24 h, Meta n&apos;accepte qu&apos;un modèle validé. Créez dans WhatsApp Manager un modèle « Utilitaire » en français avec une seule variable {"{{1}}"}, puis renseignez WHATSAPP_TEMPLATE_NAME et WHATSAPP_TEMPLATE_LANG dans Vercel.</p>
          </div>
        )}
        {causes.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {causes.map((c) => (
              <li key={c.code} className="rounded-xl border border-rose/30 bg-rose/5 p-3 text-sm">
                <p className="font-semibold text-navy">{c.count} échec{c.count > 1 ? "s" : ""} · {c.cause} <span className="font-normal text-navy/60">(code {c.code}, dernier le {c.last.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Africa/Dakar" })})</span></p>
                <p className="mt-1 text-navy/85"><strong>Solution :</strong> {c.fix}</p>
              </li>
            ))}
          </ul>
        ) : (
          cfg.active && <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-2 text-sm text-emerald-900">Aucun échec d&apos;envoi ces 7 derniers jours.</p>
        )}
        <div className="mt-4">
          <p className="text-sm font-medium text-navy">Envois automatiques activés</p>
          <ul className="mt-2 grid gap-1.5 text-sm sm:grid-cols-2">
            {sendingAutos.map((a) => (
              <li key={a.id} className="flex items-center gap-2"><span className={`h-2.5 w-2.5 shrink-0 rounded-full ${a.on ? "bg-emerald-500" : "bg-navy/25"}`} />{a.label}{!a.on && <span className="text-xs text-navy/60">(désactivé)</span>}</li>
            ))}
          </ul>
          <Link href="/admin/automatisations" className="mt-2 inline-block text-sm font-semibold text-rose-dark hover:underline">Activer ou couper un envoi →</Link>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-line bg-white p-5">
        <h2 className="font-serif-display text-lg font-semibold text-navy">Messages automatiques</h2>
        <p className="mb-4 mt-1 text-sm text-navy/75">Modifiez le texte des messages envoyés automatiquement. Les variables entre accolades sont remplacées à l&apos;envoi (prénom, n° de commande…). Un message non modifié garde son texte d&apos;origine.</p>
        <WhatsAppMessagesEditor messages={MESSAGE_KEYS.map((k) => [k, WA_MESSAGES[k]])} custom={custom} />
      </section>

      <section className="mt-6 rounded-2xl border border-line bg-white p-5">
        <h2 className="font-serif-display text-lg font-semibold text-navy">Envoyer un message de test</h2>
        <p className="mt-1 mb-3 text-sm text-navy/75">Numéro au format international, sans « + » (ex. 221770000000). En test Meta, le numéro doit avoir été ajouté et vérifié dans votre application.</p>
        <WhatsAppTestForm />
      </section>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-white">
        {messages === null ? (
          <p className="p-8 text-center text-sm text-navy/70">Le journal n&apos;est pas encore disponible (migration « WhatsAppMessage » à appliquer).</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-cream text-left text-xs uppercase text-navy/70">
              <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Numéro</th><th className="px-4 py-3">Message</th><th className="px-4 py-3">Statut</th></tr>
            </thead>
            <tbody>
              {messages.map((m) => (
                <tr key={m.id} className="border-t border-line align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-navy/75">{m.createdAt.toLocaleString("fr-FR")}</td>
                  <td className="px-4 py-3 text-xs">{m.direction === "IN" ? "← " : "→ "}{KIND[m.kind] ?? m.kind}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs">+{m.toNumber}</td>
                  <td className="max-w-md px-4 py-3 text-xs text-navy/90">{m.body.slice(0, 160)}{m.error && <p className="mt-1 text-rose-dark">{m.error}</p>}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS[m.status] ?? ""}`}>{m.status}</span>
                    {m.status === "ECHEC" && m.direction === "OUT" && (
                      <form action={resendWhatsAppMessage.bind(null, m.id)} className="mt-1.5"><button className="text-xs font-semibold text-rose-dark hover:underline">Renvoyer</button></form>
                    )}
                  </td>
                </tr>
              ))}
              {messages.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-navy/70">Aucun message pour le moment.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
