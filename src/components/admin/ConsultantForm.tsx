import type { Consultant } from "@prisma/client";

const inputClass =
  "mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-navy";
const labelClass = "text-xs font-medium text-navy/70";

export function ConsultantForm({
  action,
  consultant,
}: {
  action: (formData: FormData) => void;
  consultant?: Consultant;
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
        <label className={labelClass}>Lien WhatsApp (https://wa.me/…)</label>
        <input name="whatsapp" required defaultValue={consultant?.whatsapp} className={inputClass} />
      </div>
      <label className="flex items-center gap-2 text-sm text-navy/70">
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
