import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-page-guard";
import { prisma } from "@/lib/prisma";
import { decideFraudFlag, scanFraudNow } from "@/lib/actions/fraud";
import { RowAction } from "@/components/admin/RowAction";
import { formatPrice } from "@/lib/currency";

export const dynamic = "force-dynamic";
export const metadata = { title: "Contrôle des commissions" };

const KIND: Record<string, string> = { AUTO_ACHAT: "Auto-achat", ACHAT_PARRAIN: "Achat du parrain", FAUX_FILLEUL: "Faux filleul", CLIENT_UNIQUE: "Ventes au même client", RETOURS: "Retours abusifs" };
const STATUS: Record<string, string> = { OUVERT: "À vérifier", VALIDE: "Pas de fraude", FRAUDE: "Fraude confirmée" };

/** Signalements de fraude possible : commissions bloquées en vérification jusqu'à la décision de l'admin. */
export default async function FraudePage() {
  await requireAdminPage("comptabilite");
  const [open, closed, held] = await Promise.all([
    prisma.fraudFlag.findMany({ where: { status: "OUVERT" }, orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.fraudFlag.findMany({ where: { status: { not: "OUVERT" } }, orderBy: { resolvedAt: "desc" }, take: 30 }),
    prisma.commissionEntry.findMany({ where: { status: "EN_REVUE" }, select: { consultantId: true, orderId: true, amount: true } }),
  ]);
  const names = new Map((await prisma.consultant.findMany({ where: { id: { in: [...open, ...closed].map((f) => f.consultantId) } }, select: { id: true, name: true } })).map((c) => [c.id, c.name]));
  const heldFor = (f: { orderId: string | null; consultantId: string }) => held.filter((h) => (f.orderId ? h.orderId === f.orderId : h.consultantId === f.consultantId)).reduce((s, h) => s + h.amount, 0);
  const heldTotal = held.reduce((s, h) => s + h.amount, 0);
  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif-display text-2xl font-semibold text-navy">Contrôle des commissions</h1>
          <p className="mt-1 max-w-3xl text-sm text-navy/75">Chaque vente est contrôlée avant que les commissions soient créditées : auto-achats, achats du parrain via son filleul, faux filleuls (coordonnées partagées), ventes toutes au même client, retours anormaux. Les commissions concernées restent <strong>en vérification</strong> : rien n&apos;est versé avant votre décision.</p>
        </div>
        <RowAction label="Analyser maintenant" run={scanFraudNow} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[["Cas à vérifier", String(open.length)], ["Commissions en vérification", formatPrice(heldTotal)], ["Cas traités (récents)", String(closed.length)]].map(([l, v]) => <div key={l} className="rounded-2xl border border-line bg-white p-4"><p className="text-xs text-navy/60">{l}</p><p className="text-xl font-semibold text-navy">{v}</p></div>)}
      </div>
      <section className="space-y-3">
        {open.map((f) => (
          <article key={f.id} className="rounded-2xl border border-rose/40 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm"><span className="rounded-full bg-rose/10 px-2.5 py-0.5 text-xs font-semibold text-rose-dark">{KIND[f.kind] ?? f.kind}</span> <Link href={`/admin/consultants/${f.consultantId}`} className="ml-1 font-semibold text-navy hover:underline">{names.get(f.consultantId) ?? "Membre"}</Link> <span className="text-xs text-navy/55">· {f.createdAt.toLocaleDateString("fr-FR")}</span></p>
                <p className="mt-2 text-sm text-navy/85">{f.details}</p>
                <p className="mt-1 text-xs text-navy/65">Commissions bloquées : <strong>{formatPrice(heldFor(f))}</strong>{f.orderId && <> · <Link href={`/admin/commandes/${f.orderId}`} className="underline">commande {f.orderId.slice(-8).toUpperCase()}</Link></>}{!f.orderId && " · ses nouvelles commissions restent en vérification tant que le cas est ouvert"}</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <RowAction label="Pas de fraude : libérer" run={decideFraudFlag.bind(null, f.id, "VALIDE")} confirm="Libérer et créditer les commissions bloquées ?" />
                <RowAction label="Fraude : annuler" danger run={decideFraudFlag.bind(null, f.id, "FRAUDE")} confirm="Annuler définitivement les commissions bloquées ?" />
              </div>
            </div>
          </article>
        ))}
        {!open.length && <p className="rounded-2xl border border-line bg-white p-6 text-center text-sm text-navy/70">Aucun cas à vérifier ✅</p>}
      </section>
      {closed.length > 0 && (
        <section className="rounded-2xl border border-line bg-white p-5">
          <h2 className="font-semibold text-navy">Cas traités</h2>
          <ul className="mt-2 divide-y divide-line text-sm">
            {closed.map((f) => <li key={f.id} className="flex flex-wrap justify-between gap-2 py-2"><span>{KIND[f.kind] ?? f.kind} · {names.get(f.consultantId) ?? "Membre"}</span><span className={f.status === "FRAUDE" ? "font-semibold text-rose-dark" : "text-emerald-700"}>{STATUS[f.status]} · {f.resolvedAt?.toLocaleDateString("fr-FR")}</span></li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
