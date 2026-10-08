"use client";

import { create } from "zustand";

interface SearchState {
  isOpen: boolean;
  initial: string;
  openId: number;
  open: (initial?: string) => void;
  close: () => void;
}

/** Ouverture de la recherche plein écran depuis n'importe quel composant. */
export const useSearchStore = create<SearchState>((set) => ({
  isOpen: false,
  initial: "",
  openId: 0,
  open: (initial = "") => set((s) => ({ isOpen: true, initial, openId: s.openId + 1 })),
  close: () => set({ isOpen: false, initial: "" }),
}));
