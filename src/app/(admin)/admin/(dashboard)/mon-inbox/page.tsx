import { Download } from "lucide-react";
import { getReseller } from "@/lib/reseller";
import { NotReseller } from "@/components/admin/NotReseller";
import { KwingoInboxWindow } from "@/components/admin/KwingoInboxWindow";

export const dynamic = "force-dynamic";

export default async function MonInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string; q?: string }>;
}) {
  const me = await getReseller();
  if (!me) return <NotReseller />;
  const { p, q } = await searchParams;

  return (
    <div className="max-w-7xl">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif-display text-2xl font-semibold text-navy">
            Messagerie WhatsApp JAMAAL
          </h1>
          <p className="mt-1 text-sm text-navy/75">
            Conversations entrantes envoyées au numéro Business de <strong>JAMAAL Luxury (+221 71 180 09 09 · API Cloud)</strong> et redirigées vers vous. Répondez via l&apos;<strong>API Cloud</strong> dans la fenêtre des 24 h, ou basculez sur votre <strong>WhatsApp personnel (Mobile / PC)</strong>.
          </p>
        </div>
        <a
          href="/api/export/manuel-whatsapp-docx"
          className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-4 py-2 text-xs font-semibold text-navy shadow-2xs hover:bg-cream"
        >
          <Download size={14} />
          <span>Manuel WhatsApp (.docx Word)</span>
        </a>
      </div>

      <KwingoInboxWindow
        initialPhone={p ?? ""}
        initialSearch={q ?? ""}
        initialManager={me.id}
      />
    </div>
  );
}
