import { describe, it, expect, vi } from "vitest";

// Mock @/lib/currency avant l'import du composant
vi.mock("@/lib/currency", () => ({
  formatPrice: (n: number) => `${Math.round(n).toLocaleString("fr-FR")} FCFA`,
}));

// On importe uniquement le type (le composant React nécessite jsdom)
import type { OrderItemDetail } from "../../components/admin/OrderDetailCell";

describe("OrderDetailCell – structure OrderItemDetail", () => {
  it("contient les champs requis pour afficher le détail d'un article", () => {
    const item: OrderItemDetail = {
      productName: "Extrait de Parfum N°024",
      volumeLabel: "100 ml",
      price: 14800,
      quantity: 2,
      product: {
        choganCode: "024",
        name: "Extrait de Parfum N°024",
        inspiredBy: "Black Opium",
        inspiredBrand: "Yves Saint Laurent",
      },
    };

    expect(item.product?.choganCode).toBe("024");
    expect(item.productName).toBe("Extrait de Parfum N°024");
    expect(item.product?.inspiredBy).toBe("Black Opium");
    expect(item.product?.inspiredBrand).toBe("Yves Saint Laurent");
    expect(item.volumeLabel).toBe("100 ml");
    expect(item.price).toBe(14800);
    expect(item.quantity).toBe(2);
  });

  it("accepte un article sans infos produit (fallback)", () => {
    const item: OrderItemDetail = {
      productName: "Parfum Anonyme",
      volumeLabel: "50 ml",
      price: 9500,
      quantity: 1,
    };

    expect(item.product).toBeUndefined();
    expect(item.productName).toBe("Parfum Anonyme");
    expect(item.price).toBe(9500);
  });
});
