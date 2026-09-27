import { CategoryForm } from "@/components/admin/CategoryForm";
import { createCategory } from "@/lib/actions/categories";

export default function NewCategoryPage() {
  return (
    <div>
      <h1 className="font-serif-display text-2xl font-semibold text-navy">Nouvelle catégorie</h1>
      <CategoryForm action={createCategory} />
    </div>
  );
}
