"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingBag } from "lucide-react";
import { getOrderItemsForReorder } from "@/lib/actions/orders";
import { useCartStore } from "@/lib/cart-store";

export function ReorderButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const addItem = useCartStore((state) => state.addItem);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function reorder() {
    setBusy(true); setMessage("");
    try {
      const items = await getOrderItemsForReorder(orderId);
      if (!items.length) { setMessage("Ces articles ne sont plus disponibles."); return; }
      items.forEach((item) => addItem(item, item.quantity));
      router.push("/panier");
    } catch { setMessage("Impossible de recharger la commande pour le moment."); }
    finally { setBusy(false); }
  }
  return <div><button type="button" onClick={reorder} disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-line px-6 py-3 text-sm font-semibold text-navy disabled:opacity-50"><ShoppingBag size={16}/>{busy ? "Chargement…" : "Recommander ces articles"}</button>{message && <p role="status" className="mt-2 text-center text-xs text-navy/60">{message}</p>}</div>;
}
