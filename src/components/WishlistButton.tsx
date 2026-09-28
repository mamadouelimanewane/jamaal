"use client";

import { Heart } from "lucide-react";
import { useWishlistStore, type WishlistEntry } from "@/lib/wishlist-store";

export function WishlistButton({ item }: { item: WishlistEntry }) {
  const { has, add, remove } = useWishlistStore();
  const active = has(item.productId);

  return (
    <button
      type="button"
      aria-label={active ? "Retirer des favoris" : "Ajouter aux favoris"}
      onClick={() => (active ? remove(item.productId) : add(item))}
      className={`rounded-full border p-2 transition ${
        active
          ? "border-rose-dark bg-rose-dark/10 text-rose-dark"
          : "border-line text-navy/50 hover:border-rose-dark hover:text-rose-dark"
      }`}
    >
      <Heart size={16} fill={active ? "currentColor" : "none"} />
    </button>
  );
}
