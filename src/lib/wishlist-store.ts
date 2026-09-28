"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface WishlistEntry {
  productId: string;
  slug: string;
  name: string;
  priceLabel: string;
  colorFrom: string;
  colorTo: string;
}

interface WishlistState {
  items: WishlistEntry[];
  add: (item: WishlistEntry) => void;
  remove: (productId: string) => void;
  has: (productId: string) => boolean;
  clear: () => void;
  count: () => number;
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (item) =>
        set((s) => {
          if (s.items.some((i) => i.productId === item.productId)) return s;
          return { items: [...s.items, item] };
        }),
      remove: (productId) =>
        set((s) => ({ items: s.items.filter((i) => i.productId !== productId) })),
      has: (productId) => get().items.some((i) => i.productId === productId),
      clear: () => set({ items: [] }),
      count: () => get().items.length,
    }),
    { name: "jamaal-wishlist" }
  )
);
