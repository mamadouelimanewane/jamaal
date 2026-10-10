import Link from "next/link";
import { Paperclip } from "lucide-react";
import { accountingContext, type SP } from "@/lib/accounting/page-context";
import { CHANNELS, EXPENSE_ACCOUNTS, LEGACY_CATEGORY_ACCOUNT, labelFor } from "@/lib/accounting/chart";
import { dateFr, fcfa, isoDay } from "@/lib/accounting/format";
import { deleteExpenseAction, payExpenseAction, saveExpenseAction } from "@/lib/actions/accounting";
import { prisma } from "@/lib/prisma";
import { PeriodPicker } from "@/components/accounting/PeriodPicker";
import { Amount, btn, btnLight, Card, field, td, tdr, th, thr } from "@/components/accounting/ui";
import { BarList } from "@/components/admin/BarList";

export const dynamic = "force-dynamic";

const STATUTS = [
  { id: "", label: "Toutes" },
  { id: "a-payer", label: "À payer" },
  { id: "payees", label: "Payées" },
];

export default async function DepensesPage({ searchParams }: { searchParams: SP }) {
  const { L, period, query, get } = await accountingContext(searchParams);
  const statut = get("statut");
  const compte = get("compte");
  const q = get("q").trim();
  const editId = get("modifier");
  const today = isoDay(new Date());

  const where = {
    ...(statut === "a-payer" ? { paid: false } : { date: { gte: period.from, lt: period.to }, ...(statut === "payees" ? { paid: true } : {}) }),
    ...(compte ? { account: compte } : {}),
    ...(q ? { OR: [{ label: { contains: q, mode: "insensitive" as const } }, { supplier: { contains: q, mode: "insensitive" as const } }, { reference: { contains: q, mode: "insensitive" as const } }] } : {}),
  };
  const select = { id: true, label: true, amount: true, vatAmount: true, account: true, category: true, channel: true, supplier: true, reference: true, note: true, paid: true, paidAt: true, dueDate: true, date: true, receiptName: true, receiptMime: true } as const;
  const [expenses, editing, suppliers] = await Promise.all([
    prisma.expense.findMany({ where, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 500, select }),
    editId ? prisma.expense.findUnique({ where: { id: editId }, select }) : null,
    prisma.expense.findMany({ where: { supplier: { not: null } }, distinct: ["supplier"], select: { supplier: true }, take: 100 }),
  ]);
  const accOf = (e: { account: string | null; category: string }) => e.account || LEGACY_CATEGORY_ACCOUNT[e.category] || "638";
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const vat = expenses.reduce((s, e) => s + e.vatAmount, 0);
  const unpaid = expenses.filter((e) => !e.paid).reduce((s, e) => s + e.amount, 0);
  const byAccount = new Map<string, number>();
  for (const e of expenses) byAccount.set(accOf(e), (byAccount.get(accOf(e)) ?? 0) + e.amount);
  const customCharges = L.accounts.filter((a) => /^6/.test(a.code) && !EXPENSE_ACCOUNTS.includes(a.code) && L.settings.customAccounts.some((c) => c.code === a.code)).map((a) => a.code);
  const options = [...EXPENSE_ACCOUNTS, ...customCharges];
  const e = editing;
  const closed = e ? L.closedMonths.has(isoDay(e.date).slice(0, 7)) : false;
  const showForm = !!e || get("nouvelle") === "1";
  const keep = { statut: statut || undefined, compte: compte || undefined, q: q || undefined };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-serif-display text-xl font-semibold text-navy">Dépenses et factures</h2>
        <div className="flex flex-wrap gap-2">
          {!showForm && <Link href={`/admin/comptabilite/depenses?nouvelle=1&${query}#saisie`} className={btn}>+ Nouvelle dépense</Link>}
          <a href={`/api/export/depenses?${query}`} className={btnLight}>Excel ↓</a>
        </div>
      </div>

      {showForm && (
        <Card title={<span id="saisie">{e ? "Modifier la dépense" : "Nouvelle dépense"}</span>} action={<Link href={`/admin/comptabilite/depenses?${query}`} className="text-xs font-semibold text-navy hover:underline">Fermer</Link>}>
          {closed ? (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-950">Cette dépense est datée d&apos;un mois clôturé : rouvrez le mois pour la modifier.</p>
          ) : (
            <form action={saveExpenseAction} encType="multipart/form-data" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {e && <input type="hidden" name="id" value={e.id} />}
              <label className="text-sm text-navy sm:col-span-2">Libellé<input name="label" required defaultValue={e?.label} placeholder="ex. Commande Chogan n° 1245, loyer d'octobre…" className={`mt-1 ${field}`} /></label>
              <label className="text-sm text-navy">Montant TTC (F)<input name="amount" required inputMode="numeric" defaultValue={e?.amount} className={`mt-1 ${field}`} /></label>
              <label className="text-sm text-navy">dont TVA (F)<input name="vatAmount" inputMode="numeric" defaultValue={e?.vatAmount || ""} placeholder={L.settings.vatEnabled ? "TVA sur la facture" : "0 (TVA non récupérable)"} className={`mt-1 ${field}`} /></label>
              <label className="text-sm text-navy sm:col-span-2">Nature (compte)
                <select name="account" defaultValue={e ? accOf(e) : "601"} className={`mt-1 ${field}`}>
                  {options.map((c) => <option key={c} value={c}>{c} · {labelFor(c, L.accounts)}</option>)}
                </select>
              </label>
              <label className="text-sm text-navy">Date de la facture<input type="date" name="date" required defaultValue={e ? isoDay(e.date) : today} className={`mt-1 ${field}`} /></label>
              <label className="text-sm text-navy">Payée avec
                <select name="channel" defaultValue={e?.channel ?? "WAVE"} className={`mt-1 ${field}`}>
                  {Object.entries(CHANNELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </label>
              <label className="text-sm text-navy">Fournisseur<input name="supplier" list="suppliers" defaultValue={e?.supplier ?? ""} placeholder="ex. Chogan, Senelec…" className={`mt-1 ${field}`} /></label>
              <datalist id="suppliers">{suppliers.map((s) => <option key={s.supplier} value={s.supplier ?? ""} />)}</datalist>
              <label className="text-sm text-navy">N° de facture / reçu<input name="reference" defaultValue={e?.reference ?? ""} className={`mt-1 ${field}`} /></label>
              <label className="flex items-center gap-2 self-end pb-2 text-sm text-navy"><input type="checkbox" name="paid" defaultChecked={e ? e.paid : true} /> Déjà payée</label>
              <label className="text-sm text-navy">Payée le (si différent)<input type="date" name="paidAt" defaultValue={e?.paidAt ? isoDay(e.paidAt) : ""} className={`mt-1 ${field}`} /></label>
              <label className="text-sm text-navy">À payer avant (si pas payée)<input type="date" name="dueDate" defaultValue={e?.dueDate ? isoDay(e.dueDate) : ""} className={`mt-1 ${field}`} /></label>
              <label className="text-sm text-navy sm:col-span-2">Justificatif (photo ou PDF, 3 Mo max)<input type="file" name="receipt" accept="image/*,application/pdf" className={`mt-1 ${field}`} /></label>
              {e?.receiptName && <label className="flex items-center gap-2 text-sm text-navy sm:col-span-2"><input type="checkbox" name="removeReceipt" /> Retirer le justificatif actuel ({e.receiptName})</label>}
              <label className="text-sm text-navy sm:col-span-2 lg:col-span-4">Note<textarea name="note" rows={2} defaultValue={e?.note ?? ""} className={`mt-1 ${field}`} /></label>
              <div className="sm:col-span-2 lg:col-span-4"><button className={btn}>{e ? "Enregistrer les modifications" : "Enregistrer la dépense"}</button></div>
            </form>
          )}
          <p className="mt-3 text-xs text-navy/65">
            Achat de marchandises (601) : commandes Chogan. Règlement d&apos;une facture déjà saisie : compte 401. Paiement de la TVA : 4441. Un achat de matériel durable (téléphone, moto…) va en 244 ou 245.
            {L.settings.purchaseMode === "RECEPTIONS" && " Mode « réceptions » : les achats sont constatés à l'entrée en stock ; une dépense 601 est comptée comme règlement du fournisseur."}
          </p>
        </Card>
      )}

      <PeriodPicker path="/admin/comptabilite/depenses" period={period} keep={keep} />
      <form className="grid gap-2 rounded-2xl border border-line bg-white p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
        {period.preset === "perso" ? (<><input type="hidden" name="du" value={period.fromStr} /><input type="hidden" name="au" value={period.toStr} /></>) : <input type="hidden" name="p" value={period.preset} />}
        <select name="statut" defaultValue={statut} className={field} aria-label="Statut">{STATUTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
        <select name="compte" defaultValue={compte} className={field} aria-label="Nature">
          <option value="">Toutes les natures</option>
          {options.map((c) => <option key={c} value={c}>{c} · {labelFor(c, L.accounts)}</option>)}
        </select>
        <input name="q" defaultValue={q} placeholder="Libellé, fournisseur, n°" className={field} />
        <button className={btn}>Filtrer</button>
      </form>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Card>
          <dl className="grid grid-cols-3 gap-2 text-center">
            <div><dt className="text-xs text-navy/70">Total TTC</dt><dd className="text-lg font-semibold">{fcfa(total)}</dd></div>
            <div><dt className="text-xs text-navy/70">dont TVA</dt><dd className="text-lg font-semibold">{fcfa(vat)}</dd></div>
            <div><dt className="text-xs text-navy/70">Reste à payer</dt><dd className={`text-lg font-semibold ${unpaid ? "text-red-700" : ""}`}>{fcfa(unpaid)}</dd></div>
          </dl>
        </Card>
        <Card>
          <BarList items={[...byAccount].map(([c, v]) => ({ label: `${c} · ${labelFor(c, L.accounts)}`, value: v })).sort((a, b) => b.value - a.value).slice(0, 6)} formatValue={fcfa} color="rose" />
        </Card>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full text-sm">
          <thead className="bg-cream"><tr><th className={th}>Dépense</th><th className={th}>Date</th><th className={th}>Nature</th><th className={th}>Paiement</th><th className={thr}>Montant</th><th className={th}>Actions</th></tr></thead>
          <tbody>
            {expenses.map((x) => {
              const isClosed = L.closedMonths.has(isoDay(x.date).slice(0, 7));
              const late = !x.paid && x.dueDate && x.dueDate < new Date();
              return (
                <tr key={x.id} className="border-t border-line align-top">
                  <td className={td}>
                    <span className="font-medium">{x.label}</span>
                    <span className="block text-xs text-navy/65">{[x.supplier, x.reference && `n° ${x.reference}`].filter(Boolean).join(" · ")}</span>
                    {x.receiptName && <a href={`/api/admin/depenses/${x.id}/justificatif`} target="_blank" className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-navy underline"><Paperclip size={12} /> Justificatif</a>}
                  </td>
                  <td className={`${td} whitespace-nowrap`}>{dateFr(x.date)}</td>
                  <td className={td}><span className="font-mono text-xs">{accOf(x)}</span> {labelFor(accOf(x), L.accounts)}</td>
                  <td className={td}>
                    {x.paid ? (
                      <span className="text-emerald-800">{CHANNELS[x.channel]?.label ?? x.channel}{x.paidAt && !isoDay(x.paidAt).startsWith(isoDay(x.date)) ? ` le ${dateFr(x.paidAt)}` : ""}</span>
                    ) : (
                      <span className={`font-semibold ${late ? "text-red-700" : "text-amber-700"}`}>À payer{x.dueDate ? ` avant le ${dateFr(x.dueDate)}` : ""}</span>
                    )}
                  </td>
                  <td className={tdr}><Amount value={x.amount} strong />{x.vatAmount > 0 && <span className="block text-xs text-navy/65">TVA {x.vatAmount.toLocaleString("fr-FR")}</span>}</td>
                  <td className={td}>
                    {isClosed ? (
                      <span className="text-xs text-navy/60">Mois clôturé</span>
                    ) : (
                      <div className="flex flex-col items-end gap-1.5 sm:items-start">
                        {!x.paid && (
                          <form action={payExpenseAction} className="flex flex-wrap items-center gap-1">
                            <input type="hidden" name="id" value={x.id} />
                            <select name="channel" defaultValue={x.channel} className="rounded-lg border border-line px-2 py-1 text-xs" aria-label="Payée avec">
                              {Object.entries(CHANNELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                            </select>
                            <input type="date" name="paidAt" defaultValue={today} className="rounded-lg border border-line px-2 py-1 text-xs" aria-label="Payée le" />
                            <button className="rounded-full bg-emerald-700 px-3 py-1 text-xs font-semibold text-white">Régler</button>
                          </form>
                        )}
                        <span className="flex gap-3">
                          <Link href={`/admin/comptabilite/depenses?modifier=${x.id}&${query}#saisie`} className="text-xs font-semibold text-navy hover:underline">Modifier</Link>
                          <form action={deleteExpenseAction.bind(null, x.id)}><button className="text-xs font-semibold text-red-700 hover:underline">Supprimer</button></form>
                        </span>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {!expenses.length && <tr><td colSpan={6} className="px-3 py-6 text-center text-navy/70">Aucune dépense {statut === "a-payer" ? "à payer" : "sur cette période"}.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
