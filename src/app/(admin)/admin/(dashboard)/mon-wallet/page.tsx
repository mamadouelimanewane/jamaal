import { redirect } from "next/navigation";
import { settleRecentDeposits } from "@/lib/payment/settle";
import { viewerWallet } from "@/lib/wallet-owner";
import { WalletPanel } from "@/components/admin/WalletPanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mon wallet" };

export default async function MyWalletPage({ searchParams }: { searchParams: Promise<{ depot?: string }> }) {
  const w = await viewerWallet();
  if (!w) redirect("/admin");
  const { depot } = await searchParams;
  // Revendeur : retraits et dépôts sont dans « Mes gains » (le retour d'un dépôt en ligne y est suivi).
  if (w.owner.type === "CONSULTANT") redirect(`/admin/mes-gains${depot ? `?depot=${encodeURIComponent(depot)}` : ""}#wallet`);
  // Retour d'un dépôt en ligne : on vérifie tout de suite auprès du prestataire (sans attendre le webhook).
  if (depot === "ok") await settleRecentDeposits(w.owner);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="font-serif-display text-2xl font-semibold text-navy">Mon wallet</h1>
      <WalletPanel owner={w.owner} viewAs={w.viewAs} depot={depot} />
    </div>
  );
}
