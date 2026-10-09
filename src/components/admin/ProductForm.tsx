import { getCategories } from "@/lib/db-categories";
import type { Product, ProductVariant } from "@prisma/client";
import { FormatsEditor, type FormatRow } from "./FormatsEditor";

const inputClass =
  "mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-navy";
const labelClass = "text-xs font-medium text-navy/85";

function formatsOf(product?: Product & { variants?: ProductVariant[] }): FormatRow[] {
  const volumes = (Array.isArray(product?.volumes) ? product!.volumes : []) as { label?: string; price?: number; publicPrice?: number; code?: string }[];
  const variants = product?.variants ?? [];
  const rows: FormatRow[] = volumes
    .filter((v) => v && v.label)
    .map((v) => {
      const variant = variants.find((x) => x.volumeLabel === v.label);
      return { label: v.label!, code: v.code ?? variant?.code ?? "", price: v.price ?? "", publicPrice: v.publicPrice ?? "", threshold: variant?.lowStockThreshold ?? 3, stock: variant?.stock ?? 0 };
    });
  // Formats ayant un stock mais absents des prix (cas ancien) : affichés pour ne pas les perdre.
  for (const v of variants) if (!rows.some((r) => r.label === v.volumeLabel)) rows.push({ label: v.volumeLabel, code: v.code ?? "", price: "", publicPrice: "", threshold: v.lowStockThreshold, stock: v.stock });
  return rows;
}

export async function ProductForm({
  action,
  product,
}: {
  action: (formData: FormData) => void;
  product?: Product & { variants?: ProductVariant[] };
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
          <label className={labelClass}>N° de fiche Chogan</label>
          <input
            type="number"
            name="number"
            defaultValue={product?.number ?? undefined}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Code Chogan (ex. 001M, 060, BSF016)</label>
          <input name="choganCode" defaultValue={product?.choganCode ?? ""} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Inspiré de (parfum de marque)</label>
          <input name="inspiredBy" defaultValue={product?.inspiredBy ?? ""} placeholder="ex. Sauvage" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Marque du parfum d&apos;inspiration</label>
          <input name="inspiredBrand" defaultValue={product?.inspiredBrand ?? ""} placeholder="ex. Dior" className={inputClass} />
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
          <label className={labelClass}>Prix public Chogan (FCFA)</label>
          <input
            type="number"
            name="publicPrice"
            min={0}
            defaultValue={product?.publicPrice ?? undefined}
            className={inputClass}
          />
          <p className="mt-1 text-xs text-navy/70">Base du prix de vente (Admin &gt; Modèle économique &gt; Mettre à jour les prix).</p>
        </div>
        <div>
          <label className={labelClass}>Prix de vente (FCFA)</label>
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
          <label className={labelClass}>Stock disponible{product?.variants?.length ? " (géré par format, dans Stocks)" : ""}</label>
          <input
            type="number"
            name="stock"
            min={0}
            defaultValue={product?.stock ?? 0}
            disabled={!!product?.variants?.length}
            className={`${inputClass} disabled:bg-cream disabled:text-navy/50`}
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
        <p className={labelClass}>Formats et prix (70 ml, 30 ml, 15 ml…) — laissez vide pour un produit à format unique</p>
        <div className="mt-1"><FormatsEditor initial={formatsOf(product)} /></div>
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
            defaultValue={product?.colorFrom ?? "#1d2f4f"}
            className="mt-1 h-10 w-full rounded-lg border border-line"
          />
        </div>
        <div>
          <label className={labelClass}>Couleur dégradé — fin</label>
          <input
            type="color"
            name="colorTo"
            defaultValue={product?.colorTo ?? "#d9a99d"}
            className="mt-1 h-10 w-full rounded-lg border border-line"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-navy/85">
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
