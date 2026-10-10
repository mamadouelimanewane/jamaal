import Link from "next/link";
import { accountingContext, type SP } from "@/lib/accounting/page-context";
import { labelFor } from "@/lib/accounting/chart";
import { dateFr } from "@/lib/accounting/format";
import { auxBalances, ledger, trialBalance } from "@/lib/accounting/reports";
import { PeriodPicker } from "@/components/accounting/PeriodPicker";
import { Amount, btn, btnLight, Card, field, td, tdr, th, thr } from "@/components/accounting/ui";

export const dynamic = "force-dynamic";
const MAX_ROWS = 1500;

export default async function GrandLivrePage({ searchParams }: { searchParams: SP }) {
  const { L, period, query, get } = await accountingContext(searchParams);
  const compte = get("compte").replace(/\D/g, "").slice(0, 8);
  const aux = get("tiers");
  const used = trialBalance(L.entries, period);
  const keep = { compte: compte || undefined, tiers: aux || undefined };

  const link = (c: string, t?: string) => {
    const u = new URLSearchParams(query);
    u.set("compte", c);
    if (t) u.set("tiers", t);
    return `/admin/comptabilite/grand-livre?${u}`;
  };

  const picker = (
    <form className="grid gap-2 rounded-2xl border border-line bg-white p-3 sm:grid-cols-[1fr_auto]">
      {period.preset === "perso" ? (<><input type="hidden" name="du" value={period.fromStr} /><input type="hidden" name="au" value={period.toStr} /></>) : <input type="hidden" name="p" value={period.preset} />}
      <select name="compte" defaultValue={compte} className={field} aria-label="Compte">
        <option value="">Tous les comptes (soldes)</option>
        {L.accounts.map((a) => <option key={a.code} value={a.code}>{a.code} · {a.label}</option>)}
      </select>
      <button className={btn}>Afficher</button>
    </form>
  );

  if (!compte) {
    return (
      <div className="space-y-5">
        <h2 className="font-serif-display text-xl font-semibold text-navy">Grand livre</h2>
        <PeriodPicker path="/admin/comptabilite/grand-livre" period={period} />
        {picker}
        <div className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full text-sm">
            <thead className="bg-cream"><tr><th className={th}>Compte</th><th className={thr}>Solde début</th><th className={thr}>Débit</th><th className={thr}>Crédit</th><th className={thr}>Solde fin</th></tr></thead>
            <tbody>
              {used.map((r) => (
                <tr key={r.account} className="border-t border-line">
                  <td className={td}><Link href={link(r.account)} className="hover:underline"><span className="font-mono text-xs">{r.account}</span> {labelFor(r.account, L.accounts)}</Link></td>
                  <td className={tdr}><Amount value={r.openDebit - r.openCredit} blankZero /></td>
                  <td className={tdr}><Amount value={r.debit} blankZero /></td>
                  <td className={tdr}><Amount value={r.credit} blankZero /></td>
                  <td className={tdr}><Amount value={r.closeDebit - r.closeCredit} strong /></td>
                </tr>
              ))}
              {!used.length && <tr><td colSpan={5} className="px-3 py-6 text-center text-navy/70">Aucun mouvement.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-navy/65">Solde positif = débiteur (ce qu&apos;on possède ou qu&apos;on nous doit, charges) ; négatif = créditeur (ce qu&apos;on doit, produits).</p>
      </div>
    );
  }

  const g = ledger(L.entries, compte, period, aux || undefined);
  const tiers = ["411", "401", "4671", "4672"].includes(compte) ? auxBalances(L.entries, compte, period.to).sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance)) : [];
  const rows = g.rows.slice(-MAX_ROWS);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-serif-display text-xl font-semibold text-navy">
          <span className="font-mono">{compte}</span> · {labelFor(compte, L.accounts)}{aux && <span className="text-base font-normal"> — {aux}</span>}
        </h2>
        <div className="flex gap-2">
          <Link href={`/admin/comptabilite/grand-livre?${query}`} className={btnLight}>Tous les comptes</Link>
          <a href={`/api/export/comptabilite?type=grand-livre&compte=${compte}&${query}`} className={btnLight}>Excel ↓</a>
        </div>
      </div>
      <PeriodPicker path="/admin/comptabilite/grand-livre" period={period} keep={keep} />
      {picker}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card><p className="text-xs text-navy/70">Solde au début</p><p className="text-lg font-semibold"><Amount value={g.opening} /> F</p></Card>
        <Card><p className="text-xs text-navy/70">Total débit</p><p className="text-lg font-semibold"><Amount value={g.debit} /> F</p></Card>
        <Card><p className="text-xs text-navy/70">Total crédit</p><p className="text-lg font-semibold"><Amount value={g.credit} /> F</p></Card>
        <Card><p className="text-xs text-navy/70">Solde à la fin</p><p className="text-lg font-semibold"><Amount value={g.closing} strong /> F</p></Card>
      </div>

      {tiers.length > 0 && !aux && (
        <Card title="Soldes par tiers">
          <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
            {tiers.slice(0, 60).map((t) => (
              <li key={t.aux} className="flex justify-between gap-2 border-b border-line/60 py-1">
                <Link href={link(compte, t.aux)} className="truncate text-navy hover:underline">{t.aux}</Link>
                <Amount value={t.balance} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full text-sm">
          <thead className="bg-cream"><tr><th className={th}>Libellé</th><th className={th}>Date</th><th className={th}>Pièce</th><th className={thr}>Débit</th><th className={thr}>Crédit</th><th className={thr}>Solde</th></tr></thead>
          <tbody>
            {g.rows.length > MAX_ROWS && <tr><td colSpan={6} className="px-3 py-2 text-xs text-navy/70">{g.rows.length - MAX_ROWS} lignes plus anciennes masquées : réduisez la période ou exportez en Excel.</td></tr>}
            {rows.map((r, i) => (
              <tr key={`${r.entry.id}-${i}`} className="border-t border-line">
                <td className={td}>
                  {r.entry.source.href ? <Link href={r.entry.source.href} className="hover:underline">{r.entry.label}</Link> : r.entry.label}
                  {(r.line.aux || r.line.label) && <span className="block text-xs text-navy/65">{[r.line.aux, r.line.label].filter(Boolean).join(" · ")}</span>}
                </td>
                <td className={`${td} whitespace-nowrap`}>{dateFr(r.entry.date)}</td>
                <td className={`${td} font-mono text-xs`}>{r.entry.num}</td>
                <td className={tdr}><Amount value={r.line.debit} blankZero /></td>
                <td className={tdr}><Amount value={r.line.credit} blankZero /></td>
                <td className={tdr}><Amount value={r.balance} /></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={6} className="px-3 py-6 text-center text-navy/70">Aucun mouvement sur la période.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
