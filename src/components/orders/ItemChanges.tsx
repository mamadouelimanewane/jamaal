import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/currency";

const SETTLEMENT: Record<string, string> = {
  AUCUN: "commande pas encore payée",
  COMPLEMENT: "complément à payer par le client",
  AVOIR: "différence rendue dans l'avoir du client",
  WALLET: "écart passé sur le wallet du revendeur",
};
const BY: Record<string, string> = { CLIENT: "le client", REVENDEUR: "le revendeur", ADMIN: "l'admin" };

/** Historique des produits remplacés dans une commande (admin et espace revendeur). */
export async function ItemChanges({ orderId }: { orderId: string }) {
  const changes = await prisma.orderItemChange.findMany({ where: { orderId }, orderBy: { createdAt: "asc" } });
  if (!changes.length) return null;
  return (
    <div className="mt-3 rounded-xl bg-cream/60 p-3 text-xs text-navy/80">
      <p className="font-semibold text-navy">Produits remplacés</p>
      <ul className="mt-1 space-y-1">
        {changes.map((c) => (
          <li key={c.id}>
            {c.createdAt.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })} · {BY[c.byRole] ?? c.byRole}
            {c.byName ? ` (${c.byName})` : ""} : « {c.oldName} ({c.oldVolume}) » → « {c.newName} ({c.newVolume}) » ·{" "}
            {c.difference === 0 ? "même prix" : `${c.difference > 0 ? "+" : "−"}${formatPrice(Math.abs(c.difference))}, ${SETTLEMENT[c.settlement] ?? c.settlement}`}
          </li>
        ))}
      </ul>
    </div>
  );
}
