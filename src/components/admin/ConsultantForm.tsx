import type { Consultant } from "@prisma/client";
import { ID_TYPES } from "@/lib/protocol";
import { IdPhotoInput } from "@/components/admin/IdPhotoInput";

const inputClass =
  "mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-navy";
const labelClass = "text-xs font-medium text-navy/85";

export function ConsultantForm({
  action,
  consultant,
  sponsorOptions,
  pieces,
}: {
  action: (formData: FormData) => void;
  consultant?: Consultant & { slug?: string | null };
  sponsorOptions: { id: string; name: string; city: string; title?: string }[];
  /** Photos de pièce déjà enregistrées (fiche en modification). */
  pieces?: { front: boolean; back: boolean };
}) {
  return (
    <form action={action} className="mt-6 grid max-w-xl gap-4">
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
      <fieldset className="grid gap-3 rounded-xl border border-line bg-cream/40 p-4">
        <legend className="px-1 text-sm font-semibold text-navy">Identité</legend>
        <div>
          <label className={labelClass}>Adresse</label>
          <input name="address" maxLength={300} defaultValue={consultant?.address ?? ""} className={inputClass} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Type de pièce</label>
            <select name="idType" defaultValue={consultant?.idType ?? ""} className={inputClass}>
              <option value="">— Non renseigné —</option>
              {Object.entries(ID_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              {consultant?.idType && !(consultant.idType in ID_TYPES) && <option value={consultant.idType}>{consultant.idType}</option>}
            </select>
          </div>
          <div>
            <label className={labelClass}>Numéro de la pièce</label>
            <input name="idNumber" maxLength={30} defaultValue={consultant?.idNumber ?? ""} className={inputClass} />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <IdPhotoInput name="idFront" label="Photo recto" previewSrc={consultant && pieces?.front ? `/api/admin/consultants/${consultant.id}/piece?face=recto` : undefined} />
          <IdPhotoInput name="idBack" label="Photo verso" previewSrc={consultant && pieces?.back ? `/api/admin/consultants/${consultant.id}/piece?face=verso` : undefined} />
        </div>
        <p className="text-xs text-navy/60">Les photos sont privées : visibles des seuls administrateurs. Modifiable à tout moment.</p>
      </fieldset>
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
