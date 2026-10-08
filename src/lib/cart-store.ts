"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
  productId: string;
  slug: string;
  name: string;
  volumeLabel: string;
  price: number;
  quantity: number;
  colorFrom: string;
  colorTo: string;
}

interface CartState {
  items: CartItem[];
  isOpen: boolean;
  open: () => void;
  close: () => void;
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  removeItem: (productId: string, volumeLabel: string) => void;
  updateQuantity: (productId: string, volumeLabel: string, quantity: number) => void;
  clear: () => void;
  /** Remplace les prix par ceux du serveur (null = article retiré). Renvoie le nombre d'articles modifiés. */
  syncPrices: (prices: { productId: string; volumeLabel: string; price: number | null }[]) => number;
  total: () => number;
  count: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      addItem: (item, quantity = 1) =>
        set((state) => {
          const existing = state.items.find(
            (i) => i.productId === item.productId && i.volumeLabel === item.volumeLabel
          );
          if (existing) {
            return {
              items: state.items.map((i) =>
                i === existing ? { ...i, quantity: i.quantity + quantity } : i
              ),
              isOpen: true,
            };
          }
          return { items: [...state.items, { ...item, quantity }], isOpen: true };
        }),
      removeItem: (productId, volumeLabel) =>
        set((state) => ({
          items: state.items.filter(
            (i) => !(i.productId === productId && i.volumeLabel === volumeLabel)
          ),
        })),
      updateQuantity: (productId, volumeLabel, quantity) =>
        set((state) => ({
          items: state.items
            .map((i) =>
              i.productId === productId && i.volumeLabel === volumeLabel
                ? { ...i, quantity }
                : i
            )
            .filter((i) => i.quantity > 0),
        })),
      clear: () => set({ items: [] }),
      syncPrices: (prices) => {
        const key = (i: { productId: string; volumeLabel: string }) => `${i.productId}::${i.volumeLabel}`;
        const map = new Map(prices.map((p) => [key(p), p.price]));
        let changed = 0;
        const items = get().items.flatMap((i) => {
          if (!map.has(key(i))) return [i];
          const price = map.get(key(i));
          if (price == null) {
            changed += 1;
            return [];
          }
          if (price !== i.price) {
            changed += 1;
            return [{ ...i, price }];
          }
          return [i];
        });
        if (changed) set({ items });
        return changed;
      },
      total: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
      count: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
    }),
    {
      name: "jamaal-cart",
      // On ne mémorise que les articles : sinon le tiroir du panier se rouvrirait à chaque page.
      partialize: (state) => ({ items: state.items }),
      // Ignore un éventuel « isOpen: true » enregistré par l'ancienne version du site.
      merge: (persisted, current) => ({
        ...current,
        items: (persisted as { items?: CartItem[] } | undefined)?.items ?? [],
      }),
    }
  )
);
