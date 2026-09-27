import type { Category } from "@prisma/client";

const inputClass =
  "mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-navy";
const labelClass = "text-xs font-medium text-navy/70";

export function CategoryForm({
  action,
  category,
}: {
  action: (formData: FormData) => void;
  category?: Category;
}) {
  return (
    <form action={action} className="mt-6 grid max-w-xl gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Label (titre affiché)</label>
          <input name="label" required defaultValue={category?.label} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Slug (URL)</label>
          <input name="slug" required defaultValue={category?.slug} className={inputClass} />
        </div>
      </div>
      <div>
        <label className={labelClass}>Label court (menu)</label>
        <input name="navLabel" required defaultValue={category?.navLabel} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Description</label>
        <textarea name="description" required rows={3} defaultValue={category?.description} className={inputClass} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Accent</label>
          <select name="accent" defaultValue={category?.accent ?? "navy"} className={inputClass}>
            <option value="navy">Navy</option>
            <option value="rose">Rose</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Ordre d&apos;affichage</label>
          <input type="number" name="position" defaultValue={category?.position ?? 0} className={inputClass} />
        </div>
      </div>
      <button
        type="submit"
        className="mt-2 w-fit rounded-full bg-navy px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-light"
      >
        {category ? "Enregistrer" : "Créer"}
      </button>
    </form>
  );
}
