import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-page-guard";
import { prisma } from "@/lib/prisma";
import { getAccounts } from "@/lib/accounting/ledger";
import { parseLines } from "@/lib/accounting/posting";
import { isoDay } from "@/lib/accounting/format";
import { ManualEntryForm } from "@/components/accounting/ManualEntryForm";

export const dynamic = "force-dynamic";

export default async function ManualEntryPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  await requireAdminPage();
  const { id } = await searchParams;
  const [accounts, entry] = await Promise.all([getAccounts(), id ? prisma.journalEntry.findUnique({ where: { id } }) : null]);
  const closed = entry ? !!(await prisma.accountingPeriod.findUnique({ where: { month: isoDay(entry.date).slice(0, 7) } })) : false;
  return (
    <div className="max-w-4xl space-y-4">
      <Link href="/admin/comptabilite/journal" className="text-sm font-semibold text-navy hover:underline">← Journal</Link>
      <h2 className="font-serif-display text-xl font-semibold text-navy">{entry ? "Modifier l'écriture" : "Nouvelle écriture"}</h2>
      <p className="text-sm text-navy/75">
        Pour les opérations qui ne passent pas ailleurs : apports, virements entre comptes, emprunts, soldes d&apos;ouverture, amortissements… Les ventes, commissions, wallets et dépenses sont déjà passés automatiquement.
      </p>
      {closed ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-950">Cette écriture est datée d&apos;un mois clôturé : rouvrez le mois dans « Clôtures » pour la modifier.</p>
      ) : (
        <ManualEntryForm
          accounts={accounts}
          today={isoDay(new Date())}
          initial={entry ? { id: entry.id, date: isoDay(entry.date), journal: entry.journal, label: entry.label, reference: entry.reference ?? "", template: entry.template ?? "", lines: parseLines(entry.lines) } : undefined}
        />
      )}
    </div>
  );
}
