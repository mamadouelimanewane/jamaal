import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdminPage } from "@/lib/admin-page-guard";
import { BatchStockForm } from "@/components/admin/BatchStockForm";

export const dynamic = "force-dynamic";

export default async function StockReceptionPage() {
  await requireAdminPage();
  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/admin/stocks" className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy/75 hover:text-navy"><ArrowLeft size={16} /> Stocks</Link>
      <header>
        <p className="text-xs font-semibold uppercase tracking-[.2em] text-rose-dark">Saisie en lot</p>
        <h1 className="mt-1 font-serif-display text-3xl font-semibold text-navy">Réception et inventaire</h1>
        <p className="mt-1 text-[15px] text-navy/75">Saisissez tout un bon de livraison ou tout un comptage d&apos;un coup. Chaque ligne est vérifiée puis tracée dans l&apos;historique.</p>
      </header>
      <section className="rounded-2xl border border-line bg-white p-5 sm:p-6">
        <BatchStockForm />
      </section>
    </div>
  );
}
