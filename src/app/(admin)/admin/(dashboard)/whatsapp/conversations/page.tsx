import Link from "next/link";
import { Download } from "lucide-react";
import { requireAdmin } from "@/lib/actions/auth-guard";
import { WHATSAPP_CONTACTS } from "@/lib/contact";
import { KwingoInboxWindow } from "@/components/admin/KwingoInboxWindow";

export const dynamic = "force-dynamic";

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string; q?: string; manager?: string }>;
}) {
  await requireAdmin("whatsapp", "read");
  const { p, q, manager } = await searchParams;
  const kwingoContact = WHATSAPP_CONTACTS[0];

  return (
    <div className="max-w-7xl">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif-display text-2xl font-semibold text-navy">
            Messagerie WhatsApp JAMAAL
          </h1>
          <p className="mt-1 text-sm text-navy/75">
            Conversations entrantes et sortantes sur le numéro Business de <strong>{kwingoContact.display} ({kwingoContact.phone} · API Cloud)</strong>. Redirection automatique ou manuelle vers chaque parrain/consultant, ou maintien dans <code className="rounded bg-cream px-1.5 py-0.5 text-xs font-semibold text-navy">unassigned</code>.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <a
            href="/api/export/catalogue-whatsapp"
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3.5 py-2 font-semibold text-navy hover:bg-cream"
          >
            <Download size={14} /> Catalogue CSV (Meta)
          </a>
          <Link
            href="/admin/whatsapp/campagnes"
            className="rounded-full border border-line bg-white px-3.5 py-2 font-semibold text-navy hover:bg-cream"
          >
            Campagnes WhatsApp
          </Link>
          <Link
            href="/admin/journal-whatsapp"
            className="rounded-full border border-line bg-white px-3.5 py-2 font-semibold text-navy hover:bg-cream"
          >
            Journal WhatsApp
          </Link>
        </div>
      </div>

      <KwingoInboxWindow
        initialPhone={p ?? ""}
        initialSearch={q ?? ""}
        initialManager={manager ?? "all"}
      />
    </div>
  );
}
