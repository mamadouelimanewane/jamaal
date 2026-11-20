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
      <div className="mb-5">
        <h1 className="font-serif-display text-2xl font-semibold text-navy">
          Messagerie WhatsApp JAMAAL
        </h1>
        <p className="mt-1 text-sm text-navy/75">
          Conversations entrantes envoyées au numéro Business de <strong>JAMAAL Luxury (+221 71 180 09 09 · API Cloud)</strong> et redirigées vers vous (automatiquement ou manuellement). Répondez directement ici via l&apos;API Cloud dans la fenêtre des 24 h (ou via un modèle de réponse rapide approuvé par Meta), ou ouvrez la discussion sur votre WhatsApp personnel (mobile ou PC).
        </p>
      </div>

      <KwingoInboxWindow
        initialPhone={p ?? ""}
        initialSearch={q ?? ""}
        initialManager={me.id}
      />
    </div>
  );
}
