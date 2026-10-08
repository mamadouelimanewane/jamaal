import type { Consultant } from "@prisma/client";

const inputClass =
  "mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-navy";
const labelClass = "text-xs font-medium text-navy/85";

export function ConsultantForm({
  action,
  consultant,
  sponsorOptions,
}: {
  action: (formData: FormData) => void;
  consultant?: Consultant & { slug?: string | null };
  sponsorOptions: { id: string; name: string; city: string; title?: string }[];
}) {
  return (
    <form action={action} className="mt-6 grid max-w-lg gap-4">
      <div>
        <label className={labelClass}>Nom</label>
        <input name="name" required defaultValue={consultant?.name} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Ville</label>
        <input name="city" required defaultValue={consultant?.city} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Slug du lien personnel</label>
        <div className="mt-1 flex items-center gap-2">
          <span className="shrink-0 text-xs text-navy/70">/c/</span>
          <input
            name="slug"
            defaultValue={consultant?.slug ?? ""}
            placeholder="aminata-dakar"
            pattern="[a-z0-9-]{2,48}"
            title="Minuscules, chiffres et tirets uniquement (2 à 48 caractères)"
            className={inputClass + " mt-0"}
          />
        </div>
        <p className="mt-1 text-xs text-navy/65">
          Lien partageable : jamaal…/c/<strong>slug</strong>. Laissez vide pour générer automatiquement.
        </p>
      </div>
      <div>
        <label className={labelClass}>Lien WhatsApp (https://wa.me/…)</label>
        <input name="whatsapp" required defaultValue={consultant?.whatsapp} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>E-mail (optionnel)</label>
        <input type="email" name="email" defaultValue={consultant?.email ?? ""} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Parrain (Leader ou Parrain direct qui l&apos;a recruté)</label>
        <select name="sponsorId" defaultValue={consultant?.sponsorId ?? ""} className={inputClass}>
          <option value="">— Aucun : Leader rattaché directement à JAMAAL —</option>
          {sponsorOptions
            .filter((s) => s.id !== consultant?.id)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.city}){s.title ? ` · ${s.title}` : ""}
              </option>
            ))}
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm text-navy/85">
        <input type="checkbox" name="active" defaultChecked={consultant?.active ?? true} />
        Actif (visible sur le site)
      </label>
      <button
        type="submit"
        className="mt-2 w-fit rounded-full bg-navy px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-light"
      >
        {consultant ? "Enregistrer" : "Créer"}
      </button>
    </form>
  );
}
