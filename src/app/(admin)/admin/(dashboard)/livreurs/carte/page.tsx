import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/actions/auth-guard";
import { fleetSnapshot } from "@/lib/tour/fleet";
import { FleetMap } from "@/components/admin/FleetMap";

export const dynamic = "force-dynamic";

/** Carte de la flotte en direct : livreurs géolocalisés, trajets, livraisons en cours et à attribuer. */
export default async function FleetMapPage() {
  await requireAdmin("livraison", "read");
  const fleet = await fleetSnapshot();
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/admin/livreurs" aria-label="Retour aux livreurs" className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-white text-navy hover:bg-cream">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="font-serif-display text-2xl font-semibold text-navy">Carte de la flotte en direct</h1>
            <p className="text-sm text-navy/75">Positions GPS des livreurs, livraisons en cours et à attribuer.</p>
          </div>
        </div>
        <Link href="/admin/livraisons" className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold text-navy hover:bg-cream">Livraisons</Link>
      </div>
      <FleetMap initial={fleet} />
    </div>
  );
}
