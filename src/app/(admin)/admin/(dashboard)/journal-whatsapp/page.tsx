import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/actions/auth-guard";
import { whatsappConfig } from "@/lib/whatsapp";
import { WhatsAppTestForm } from "@/components/admin/WhatsAppTestForm";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = {
  SIMULE: "bg-navy/10 text-navy/75",
  ENVOYE: "bg-blue-100 text-blue-800",
  LIVRE: "bg-emerald-100 text-emerald-800",
  LU: "bg-emerald-200 text-emerald-900",
  ECHEC: "bg-rose/20 text-rose-dark",
  RECU: "bg-amber-100 text-amber-800",
};
const KIND: Record<string, string> = { team: "Équipe", reseller: "Revendeur", test: "Test", inbound: "Reçu" };

export default async function JournalWhatsAppPage() {
  await requireAdmin();
  const cfg = whatsappConfig();
  const messages = await prisma.whatsAppMessage.findMany({ orderBy: { createdAt: "desc" }, take: 100 }).catch(() => null);

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
                  <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS[m.status] ?? ""}`}>{m.status}</span></td>
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
