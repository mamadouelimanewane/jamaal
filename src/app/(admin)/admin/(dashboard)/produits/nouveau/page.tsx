import { ProductForm } from "@/components/admin/ProductForm";
import { createProduct } from "@/lib/actions/products";

export default function NewProductPage() {
  return (
    <div>
      <h1 className="font-serif-display text-2xl font-semibold text-navy">Nouveau produit</h1>
      <ProductForm action={createProduct} />
    </div>
  );
}
