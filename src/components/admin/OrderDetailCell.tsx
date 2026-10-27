import { formatPrice } from "@/lib/currency";

export interface OrderItemDetail {
  id?: string;
  productName: string;
  volumeLabel: string;
  price: number;
  quantity: number;
  product?: {
    choganCode?: string | null;
    name?: string | null;
    inspiredBy?: string | null;
    inspiredBrand?: string | null;
  } | null;
}

/**
 * Affiche le détail complet d'une commande dans le tableau des commandes :
 * - Code produit (ex. 001M, 060, BSF016)
 * - Nom du produit
 * - Nom inspiré (ex. Inspiré de Sauvage - Dior)
 * - Contenance / Format (ex. 100 ml, 30 ml)
 * - Prix unitaire et total
 */
export function OrderDetailCell({ items }: { items: OrderItemDetail[] }) {
  if (!items || items.length === 0) {
    return <span className="text-xs text-navy/40 italic">Aucun article</span>;
  }

  return (
    <div className="flex flex-col gap-1.5 py-1 min-w-[240px] max-w-sm">
      {items.map((it, idx) => {
        const code = it.product?.choganCode;
        const inspired = it.product?.inspiredBy;
        const brand = it.product?.inspiredBrand;
        return (
          <div
            key={it.id || idx}
            className="rounded-xl border border-line bg-cream/35 p-2 text-xs transition hover:bg-cream/60"
          >
            <div className="flex flex-wrap items-center gap-1.5 font-semibold text-navy">
              {code ? (
                <span className="rounded bg-navy px-1.5 py-0.5 font-mono text-[10px] font-bold text-white tracking-wide shadow-xs">
                  {code}
                </span>
              ) : null}
              <span className="leading-snug">{it.productName}</span>
              {it.quantity > 1 ? (
                <span className="rounded-full bg-rose/20 px-1.5 py-0.5 text-[10px] font-bold text-rose-dark">
                  ×{it.quantity}
                </span>
              ) : null}
            </div>

            {inspired ? (
              <p className="mt-0.5 text-[11px] italic text-rose-dark font-medium leading-tight">
                Inspiré de : {inspired} {brand ? `(${brand})` : ""}
              </p>
            ) : null}

            <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-navy/70">
              <span className="inline-flex items-center rounded-md bg-white border border-line px-1.5 py-0.5 font-medium">
                {it.volumeLabel || "Standard"}
              </span>
              <span className="font-semibold text-navy">
                {formatPrice(it.price * it.quantity)}
                {it.quantity > 1 ? (
                  <span className="font-normal text-navy/50 text-[10px]">
                    {" "}
                    ({formatPrice(it.price)}/u)
                  </span>
                ) : null}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
