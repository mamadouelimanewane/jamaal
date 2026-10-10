import Link from "next/link";
import { accountingContext, type SP } from "@/lib/accounting/page-context";
import { JOURNALS, labelFor } from "@/lib/accounting/chart";
import { dateFr } from "@/lib/accounting/format";
import { deleteManualEntryAction } from "@/lib/actions/accounting";
import { PeriodPicker } from "@/components/accounting/PeriodPicker";
import { Amount, btn, btnLight, Card, field } from "@/components/accounting/ui";

export const dynamic = "force-dynamic";
const PAGE = 60;

export default async function JournalPage({ searchParams }: { searchParams: SP }) {
  const { L, period, query, get } = await accountingContext(searchParams);
  const journal = get("j");
  const q = get("q").toLowerCase();
  const compte = get("compte");
  const page = Math.max(1, Number(get("page")) || 1);
  const list = L.entries.filter(
    (e) =>
      e.date >= period.from &&
      e.date < period.to &&
      (!journal || e.journal === journal) &&
      (!compte || e.lines.some((l) => l.account.startsWith(compte))) &&
      (!q || `${e.label} ${e.ref ?? ""} ${e.num} ${e.lines.map((l) => `${l.aux ?? ""} ${l.label ?? ""}`).join(" ")}`.toLowerCase().includes(q))
  );
  const totalD = list.reduce((s, e) => s + e.lines.reduce((x, l) => x + l.debit, 0), 0);
  const totalC = list.reduce((s, e) => s + e.lines.reduce((x, l) => x + l.credit, 0), 0);
  const shown = list.slice((page - 1) * PAGE, page * PAGE);
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const keep = { j: journal || undefined, q: q || undefined, compte: compte || undefined };
  const pageLink = (p: number) => {
    const u = new URLSearchParams(query);
    for (const [k, v] of Object.entries(keep)) if (v) u.set(k, v);
    u.set("page", String(p));
    return `/admin/comptabilite/journal?${u}`;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-serif-display text-xl font-semibold text-navy">Journal des écritures</h2>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/comptabilite/journal/saisie" className={btn}>+ Écriture manuelle</Link>
          <a href={`/api/export/comptabilite?type=journal&${query}`} className={btnLight}>Excel ↓</a>
          <a href={`/api/export/comptabilite?type=fec&${query}`} className={btnLight}>Fichier des écritures (FEC) ↓</a>
        </div>
      </div>
      <PeriodPicker path="/admin/comptabilite/journal" period={period} keep={keep} />
      <form className="grid gap-2 rounded-2xl border border-line bg-white p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
        {period.preset === "perso" ? (<><input type="hidden" name="du" value={period.fromStr} /><input type="hidden" name="au" value={period.toStr} /></>) : <input type="hidden" name="p" value={period.preset} />}
        <select name="j" defaultValue={journal} className={field} aria-label="Journal">
          <option value="">Tous les journaux</option>
          {Object.entries(JOURNALS).map(([k, v]) => <option key={k} value={k}>{k} · {v}</option>)}
        </select>
        <input name="compte" defaultValue={compte} placeholder="Compte (ex. 571, 6)" className={field} inputMode="numeric" />
        <input name="q" defaultValue={get("q")} placeholder="Rechercher (client, libellé, n°)" className={field} />
        <button className={btn}>Filtrer</button>
      </form>

      <p className="text-sm text-navy/80">
        {list.length.toLocaleString("fr-FR")} écriture(s) · débit <Amount value={totalD} strong /> F · crédit <Amount value={totalC} strong /> F {totalD === totalC ? "✓" : "✗ déséquilibre"}
      </p>

      <div className="space-y-3">
        {shown.map((e) => {
          const manual = e.source.type === "MANUELLE";
          const closed = L.closedMonths.has(e.date.toISOString().slice(0, 7));
          return (
            <article key={e.id} className="rounded-2xl border border-line bg-white p-3 sm:p-4">
              <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="font-semibold text-navy">
                  <span className="mr-2 rounded bg-cream px-1.5 py-0.5 font-mono text-[11px] text-navy/80">{e.num}</span>
                  {e.label}
                </p>
                <p className="text-xs text-navy/70">
                  {dateFr(e.date)} · {JOURNALS[e.journal] ?? e.journal}
                  {e.ref && <> · {e.ref}</>}
                  {e.source.href && <> · <Link href={e.source.href} className="font-semibold text-navy underline">{manual ? "modifier" : "voir l'origine"}</Link></>}
                </p>
              </header>
              <table className="keep-table mt-2 w-full text-sm">
                <tbody>
                  {e.lines.map((l, i) => (
                    <tr key={i} className="border-t border-line/70">
                      <td className="py-1.5 pr-2 align-top">
                        <span className="font-mono text-xs text-navy/80">{l.account}</span> <span className="text-navy">{labelFor(l.account, L.accounts)}</span>
                        {(l.aux || l.label) && <span className="block text-xs text-navy/65">{[l.aux, l.label].filter(Boolean).join(" · ")}</span>}
                      </td>
                      <td className="w-24 py-1.5 text-right align-top sm:w-32">{l.debit ? <Amount value={l.debit} /> : ""}</td>
                      <td className="w-24 py-1.5 text-right align-top sm:w-32">{l.credit ? <Amount value={l.credit} /> : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {manual && !closed && (
                <form action={deleteManualEntryAction.bind(null, e.source.id)} className="mt-2 text-right">
                  <button className="text-xs font-semibold text-red-700 hover:underline">Supprimer cette écriture</button>
                </form>
              )}
            </article>
          );
        })}
        {!shown.length && <Card><p className="text-center text-sm text-navy/70">Aucune écriture sur cette période.</p></Card>}
      </div>

      {pages > 1 && (
        <nav className="flex flex-wrap items-center justify-center gap-2 text-sm">
          {page > 1 && <Link href={pageLink(page - 1)} className={btnLight}>← Précédent</Link>}
          <span className="text-navy/70">Page {page} / {pages}</span>
          {page < pages && <Link href={pageLink(page + 1)} className={btnLight}>Suivant →</Link>}
        </nav>
      )}
      <p className="text-xs text-navy/65">Colonnes : compte · débit · crédit. Les écritures automatiques se corrigent à la source (commande, dépense, wallet) ; seules les écritures manuelles se modifient ici.</p>
    </div>
  );
}
