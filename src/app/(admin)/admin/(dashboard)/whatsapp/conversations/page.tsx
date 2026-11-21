import { requireAdmin } from "@/lib/actions/auth-guard";
import { WHATSAPP_CONTACTS } from "@/lib/contact";
import { getKwingoConnection } from "@/lib/whatsapp/kwingo-bridge";
import { KwingoInboxWindow } from "@/components/admin/KwingoInboxWindow";
import { WhatsAppSubNav } from "@/components/admin/WhatsAppSubNav";

export const dynamic = "force-dynamic";

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string; q?: string; manager?: string }>;
}) {
  await requireAdmin("whatsapp", "read");
  const [{ p, q, manager }, kwingoConn] = await Promise.all([
    searchParams,
    getKwingoConnection(),
  ]);
  const kwingoContact = WHATSAPP_CONTACTS[0];

  return (
    <div className="max-w-7xl">
      <WhatsAppSubNav connected={kwingoConn.connected} />

      <div className="mb-4">
        <h1 className="font-serif-display text-2xl font-semibold text-navy">
          Messagerie & Conversations WhatsApp
        </h1>
        <p className="mt-0.5 text-sm text-navy/75">
          Boîte de réception en direct du numéro Business <strong>{kwingoContact.display} ({kwingoContact.phone} · API Cloud)</strong>. Filtrez par parrain/consultant ou <code className="rounded bg-cream px-1.5 py-0.5 text-xs font-semibold text-navy">unassigned</code>, consultez les commandes du client et répondez par API Cloud ou WhatsApp personnel.
        </p>
      </div>

      <KwingoInboxWindow
        initialPhone={p ?? ""}
        initialSearch={q ?? ""}
        initialManager={manager ?? "all"}
      />
    </div>
  );
}
