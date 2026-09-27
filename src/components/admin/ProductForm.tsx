import { getCategories } from "@/lib/db-categories";
import type { Product } from "@prisma/client";

const inputClass =
  "mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-navy";
const labelClass = "text-xs font-medium text-navy/70";

function volumesToText(volumes: unknown): string {
  if (!Array.isArray(volumes)) return "";
  return volumes
    .map((v) => (v && typeof v === "object" ? `${(v as { label: string }).label}|${(v as { price: number }).price}` : ""))
    .filter(Boolean)
    .join("\n");
}

export async function ProductForm({
  action,
  product,
}: {
  action: (formData: FormData) => void;
  product?: Product;
}) {
  const categories = await getCategories();
  return (
    <form action={action} className="mt-6 grid max-w-3xl gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Nom</label>
          <input name="name" required defaultValue={product?.name} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Slug (URL)</label>
          <input name="slug" required defaultValue={product?.slug} className={inputClass} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className={labelClass}>Catégorie</label>
          <select name="category" required defaultValue={product?.category} className={inputClass}>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Famille olfactive</label>
          <input name="family" defaultValue={product?.family ?? ""} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Numéro (catalogue)</label>
          <input
            type="number"
            name="number"
            defaultValue={product?.number ?? undefined}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>Description courte</label>
        <textarea
          name="shortDescription"
          required
          rows={2}
          defaultValue={product?.shortDescription}
          className={inputClass}
        />
      </div>

      <div>
        <label className={labelClass}>Description longue (une phrase par ligne)</label>
        <textarea
          name="longDescription"
          rows={4}
          defaultValue={product?.longDescription.join("\n")}
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className={labelClass}>Notes de tête (séparées par virgule)</label>
          <input name="topNotes" defaultValue={product?.topNotes.join(", ")} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Notes de cœur</label>
          <input name="heartNotes" defaultValue={product?.heartNotes.join(", ")} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Notes de fond</label>
          <input name="baseNotes" defaultValue={product?.baseNotes.join(", ")} className={inputClass} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Prix testeur (FCFA)</label>
          <input
            type="number"
            name="testerPrice"
            defaultValue={product?.testerPrice ?? undefined}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Prix régulier (FCFA)</label>
          <input
            type="number"
            name="regularPrice"
            defaultValue={product?.regularPrice ?? undefined}
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Stock disponible</label>
          <input
            type="number"
            name="stock"
            min={0}
            defaultValue={product?.stock ?? 0}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Seuil d&apos;alerte stock bas</label>
          <input
            type="number"
            name="lowStockThreshold"
            min={0}
            defaultValue={product?.lowStockThreshold ?? 5}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>
          Volumes / variantes — une ligne par variante, format « Label|Prix » (ex: 50ml|45000)
        </label>
        <textarea
          name="volumes"
          rows={3}
          defaultValue={volumesToText(product?.volumes)}
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Badge</label>
          <select name="badge" defaultValue={product?.badge ?? ""} className={inputClass}>
            <option value="">Aucun</option>
            <option value="bestseller">Bestseller</option>
            <option value="nouveau">Nouveau</option>
            <option value="epuise">Épuisé</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Photo (chemin ou URL)</label>
          <input name="photo" defaultValue={product?.photo ?? ""} className={inputClass} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Couleur dégradé — début</label>
          <input
            type="color"
            name="colorFrom"
            defaultValue={product?.colorFrom ?? "#16233a"}
            className="mt-1 h-10 w-full rounded-lg border border-line"
          />
        </div>
        <div>
          <label className={labelClass}>Couleur dégradé — fin</label>
          <input
            type="color"
            name="colorTo"
            defaultValue={product?.colorTo ?? "#c9997a"}
            className="mt-1 h-10 w-full rounded-lg border border-line"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-navy/70">
        <input type="checkbox" name="isOfficial" defaultChecked={product?.isOfficial ?? true} />
        Produit officiel (catalogue importé)
      </label>

      <button
        type="submit"
        className="mt-2 w-fit rounded-full bg-navy px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-light"
      >
        {product ? "Enregistrer les modifications" : "Créer le produit"}
      </button>
    </form>
  );
}
