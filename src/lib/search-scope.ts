/**
 * Ce que la recherche du menu peut renvoyer à un membre de l'équipe (pur, testé).
 * Règle : un revendeur ou un livreur ne voit que ses propres commandes (et, pour le revendeur,
 * ses propres clients) ; un administrateur restreint ne voit que les modules de son profil.
 */
import { allows, type Permissions } from "@/lib/permissions";

export interface SearchScope {
  /** Filtre des commandes visibles, ou null : aucune commande. */
  orders: { consultantId: string } | { livreurId: string } | Record<string, never> | null;
  /** « all » : tout le fichier clients ; « own » : clients de ses commandes ; « none ». */
  customers: "all" | "own" | "none";
  products: boolean;
  consultants: boolean;
}

export function searchScope(input: { role: string; perms: Permissions | null; consultantId: string | null; livreurId: string | null }): SearchScope {
  const { role, perms, consultantId, livreurId } = input;
  if (role === "ADMIN") {
    const can = (m: Parameters<typeof allows>[1]) => allows(perms, m, "read");
    return {
      orders: can("commandes") ? {} : null,
      customers: can("clients") ? "all" : "none",
      products: can("catalogue"),
      consultants: can("revendeurs"),
    };
  }
  if (role === "CONSULTANT") {
    return { orders: consultantId ? { consultantId } : null, customers: consultantId ? "own" : "none", products: true, consultants: false };
  }
  if (role === "LIVREUR") {
    return { orders: livreurId ? { livreurId } : null, customers: "none", products: true, consultants: false };
  }
  return { orders: null, customers: "none", products: false, consultants: false };
}
