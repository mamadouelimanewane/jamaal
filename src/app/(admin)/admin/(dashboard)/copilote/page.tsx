import Link from "next/link";
import { getReseller, resellerLinks } from "@/lib/reseller";
import { copilotPlanFor } from "@/lib/copilot/run";
import { CopilotList } from "@/components/copilot/CopilotList";
import { NotReseller } from "@/components/admin/NotReseller";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mes actions du jour" };

/** Copilote de vente : les 5 actions du jour du consultant, messages déjà rédigés. */
export default async function CopilotePage() {
  const me = await getReseller();
  if (!me) return <NotReseller />;
  const links = await resellerLinks(me.slug ?? null);
  const now = new Date();
  const actions = await copilotPlanFor(me.id, links.origin.replace(/\/$/, ""), now);
  return (
    <div className="max-w-3xl">
      <h1 className="font-serif-display text-2xl font-semibold text-navy">Mes actions du jour</h1>
      <p className="mt-1 text-sm text-navy/75">Votre copilote a préparé vos actions : chaque message est déjà rédigé. Touchez « Envoyer sur WhatsApp », vérifiez, envoyez. C&apos;est tout.</p>
      <div className="mt-6">
        {actions.length ? (
          <CopilotList actions={actions} day={now.toISOString().slice(0, 10)} />
        ) : (
          <div className="rounded-2xl border border-line bg-white p-6 text-center text-sm text-navy/75">
            <p className="font-semibold text-navy">Rien d&apos;urgent aujourd&apos;hui 👌</p>
            <p className="mt-1">Profitez-en pour publier un produit en statut ou partager votre boutique.</p>
            <Link href="/admin/mon-marketing" className="mt-4 inline-block rounded-full bg-navy px-5 py-2.5 font-semibold text-white">Mon marketing</Link>
          </div>
        )}
      </div>
      <p className="mt-6 text-xs text-navy/60">Chaque matin, vos actions arrivent aussi sur WhatsApp. Clients à relancer : dernier achat il y a 35 à 75 jours ; un client qui a répondu STOP n&apos;est jamais proposé.</p>
    </div>
  );
}
