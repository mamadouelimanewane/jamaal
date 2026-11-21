import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/actions/auth-guard";
import { whatsappConfig } from "@/lib/whatsapp";
import { getKwingoConnection } from "@/lib/whatsapp/kwingo-bridge";
import Link from "next/link";
import { WhatsAppTestForm } from "@/components/admin/WhatsAppTestForm";
import { WhatsAppSubNav } from "@/components/admin/WhatsAppSubNav";
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
const KIND: Record<string, string> = {
  team: "Équipe",
  reseller: "Consultant",
  test: "Test",
  inbound: "Reçu",
  client: "Client",
  bot: "Assistant",
  relance: "Relance",
  avis: "Avis",
  resume: "Résumé",
  suivi: "Suivi commande",
  livreur: "Livreur",
  kit: "Kit du matin",
  campagne: "Campagne",
  conseiller: "Conseiller",
};

export default async function JournalWhatsAppPage() {
  await requireAdmin("whatsapp", "read");
  const cfg = whatsappConfig();
  const since = daysAgo(7);
  const [kwingoConn, messages, week, failures, autos] = await Promise.all([
    getKwingoConnection(),
    prisma.whatsAppMessage.findMany({ orderBy: { createdAt: "desc" }, take: 100 }).catch(() => null),
    prisma
      .whatsAppMessage.groupBy({
        by: ["status"],
        where: { direction: "OUT", createdAt: { gte: since } },
        _count: { _all: true },
      })
      .catch(() => []),
    prisma
      .whatsAppMessage.findMany({
        where: { direction: "OUT", status: "ECHEC", createdAt: { gte: since } },
        select: { error: true, createdAt: true },
        take: 500,
      })
      .catch(() => []),
    automationStates().catch(() => null),
  ]);

  const isCloudActive = kwingoConn.connected || cfg.active;
  const count = (st: string) => week.find((w) => w.status === st)?._count._all ?? 0;
  const causes = groupFailures(failures);
  const sendingAutos = (
    ["orderTracking", "relance45", "birthday", "cart", "reviews", "alerts", "welcome", "morningKit", "summary"] as const
  ).map((id) => ({ id, label: AUTOMATIONS[id].label, on: autos ? autos[id] : true }));

  return (
    <div className="max-w-6xl space-y-6">
      <WhatsAppSubNav connected={isCloudActive} />

      <div>
        <h1 className="font-serif-display text-2xl font-semibold text-navy">
          Journal & Diagnostic WhatsApp
        </h1>
        <p className="mt-1 text-sm text-navy/75">
          Supervision technique de la passerelle API Cloud JAMAAL Luxury (+221 71 180 09 09), test d&apos;envoi et historique des 100 derniers messages.
        </p>
      </div>

      {/* Grille 2 colonnes aérée : État & Diagnostic à gauche / Test rapide à droite */}
      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <section className="rounded-2xl border border-line bg-white p-5 shadow-2xs">
          <h2 className="font-serif-display text-lg font-semibold text-navy">
            Diagnostic des 7 derniers jours
          </h2>

          <dl className="mt-3 grid grid-cols-2 gap-2.5 text-sm sm:grid-cols-4">
            {(
              [
                ["Acceptés par Meta", count("ENVOYE") + count("LIVRE") + count("LU"), "text-navy"],
                ["Livrés ou lus", count("LIVRE") + count("LU"), "text-emerald-700"],
                ["En échec", count("ECHEC"), "text-rose-dark"],
                ["Simulés", count("SIMULE"), "text-amber-800"],
              ] as const
            ).map(([l, n, c]) => (
              <div key={l} className="rounded-xl border border-line bg-cream/25 px-3 py-2.5">
                <dt className="text-xs text-navy/70">{l}</dt>
                <dd className={`mt-0.5 text-xl font-semibold ${c}`}>{n}</dd>
              </div>
            ))}
          </dl>

          <dl className="mt-4 grid gap-2 border-t border-line pt-4 text-xs sm:grid-cols-[11rem_1fr]">
            <dt className="text-navy/65">Passerelle active</dt>
            <dd className="font-semibold text-navy">
              {kwingoConn.connected
                ? `KwingoChat · ${kwingoConn.companyName || "Jamaal Luxury"} (+221 71 180 09 09)`
                : cfg.provider}
            </dd>
            <dt className="text-navy/65">Envoi réel API Cloud</dt>
            <dd className={isCloudActive ? "font-semibold text-emerald-700" : "font-semibold text-amber-700"}>
              {isCloudActive
                ? `Activé (${kwingoConn.email || "API Cloud connectée"})`
                : "Simulation (connectez KwingoChat dans l'onglet Messagerie)"}
            </dd>
          </dl>

          {causes.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {causes.map((c) => (
                <li key={c.code} className="rounded-xl border border-rose/30 bg-rose/5 p-3 text-xs">
                  <p className="font-semibold text-navy">
                    {c.count} échec{c.count > 1 ? "s" : ""} · {c.cause}{" "}
                    <span className="font-normal text-navy/60">
                      (code {c.code}, dernier le{" "}
                      {c.last.toLocaleString("fr-FR", {
                        dateStyle: "short",
                        timeStyle: "short",
                        timeZone: "Africa/Dakar",
                      })}
                      )
                    </span>
                  </p>
                  <p className="mt-1 text-navy/85">
                    <strong>Solution :</strong> {c.fix}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            isCloudActive && (
              <p className="mt-4 rounded-xl bg-emerald-50 px-3.5 py-2 text-xs font-medium text-emerald-900 border border-emerald-200">
                ✓ Aucun échec d&apos;envoi détecté sur les 7 derniers jours.
              </p>
            )
          )}
        </section>

        {/* Colonne droite : Test rapide + Envois automatiques actifs */}
        <div className="space-y-5">
          <section className="rounded-2xl border border-line bg-white p-5 shadow-2xs">
            <h2 className="font-serif-display text-lg font-semibold text-navy">
              Envoyer un message de test
            </h2>
            <p className="mb-3 mt-1 text-xs text-navy/70">
              Numéro au format international (ex. <code>221775690348</code>).
            </p>
            <WhatsAppTestForm />
          </section>

          <section className="rounded-2xl border border-line bg-white p-5 shadow-2xs">
            <div className="flex items-center justify-between">
              <h2 className="font-serif-display text-base font-semibold text-navy">
                Automatisations WhatsApp
              </h2>
              <Link
                href="/admin/automatisations"
                className="text-xs font-semibold text-ia-dark hover:underline"
              >
                Gérer →
              </Link>
            </div>
            <ul className="mt-3 grid gap-1.5 text-xs sm:grid-cols-2">
              {sendingAutos.map((a) => (
                <li key={a.id} className="flex items-center gap-2 text-navy/85">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      a.on ? "bg-emerald-500" : "bg-navy/25"
                    }`}
                  />
                  <span className="truncate">{a.label}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      {/* Tableau du journal des 100 derniers messages */}
      <section className="overflow-x-auto rounded-2xl border border-line bg-white shadow-2xs">
        <div className="border-b border-line px-5 py-3.5">
          <h2 className="font-serif-display text-base font-semibold text-navy">
            Historique des 100 derniers messages (entrants & sortants)
          </h2>
        </div>
        {messages === null ? (
          <p className="p-8 text-center text-sm text-navy/70">
            Le journal n&apos;est pas encore disponible.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-cream text-left text-xs uppercase text-navy/70">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Numéro</th>
                <th className="px-4 py-3">Message</th>
                <th className="px-4 py-3">Statut</th>
              </tr>
            </thead>
            <tbody>
              {messages.map((m) => (
                <tr key={m.id} className="border-t border-line align-top hover:bg-cream/30">
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-navy/75">
                    {m.createdAt.toLocaleString("fr-FR")}
                  </td>
                  <td className="px-4 py-3 text-xs font-medium text-navy">
                    {m.direction === "IN" ? "← " : "→ "}
                    {KIND[m.kind] ?? m.kind}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-navy/80">
                    +{m.toNumber}
                  </td>
                  <td className="max-w-md px-4 py-3 text-xs text-navy/90">
                    {m.body.slice(0, 160)}
                    {m.error && <p className="mt-1 text-rose-dark">{m.error}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS[m.status] ?? ""}`}>
                      {m.status}
                    </span>
                    {m.status === "ECHEC" && m.direction === "OUT" && (
                      <form action={resendWhatsAppMessage.bind(null, m.id)} className="mt-1.5">
                        <button className="text-xs font-semibold text-rose-dark hover:underline">
                          Renvoyer
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
              {messages.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-navy/70">
                    Aucun message pour le moment.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
