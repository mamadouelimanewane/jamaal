import { Suspense } from "react";
import { requireAdminPage } from "@/lib/admin-page-guard";
import { AccountingNav } from "@/components/accounting/AccountingNav";
import { FlashOk } from "@/components/accounting/FlashOk";

export default async function ComptabiliteLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPage();
  return (
    <div className="accounting">
      <div className="print:hidden">
        <h1 className="font-serif-display text-2xl font-semibold text-navy">Comptabilité &amp; finance</h1>
        <p className="mt-1 text-sm text-navy/75">Plan comptable SYSCOHADA. Les ventes, encaissements, commissions, wallets et stocks sont passés en écriture automatiquement ; vous saisissez les dépenses et les opérations diverses.</p>
        <Suspense fallback={null}>
          <AccountingNav />
          <FlashOk />
        </Suspense>
      </div>
      <div className="mt-5">{children}</div>
    </div>
  );
}
