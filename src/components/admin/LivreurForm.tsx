import type { Livreur } from "@prisma/client";

const inputClass =
  "mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-navy";
const labelClass = "text-xs font-medium text-navy/70";

export function LivreurForm({
  action,
  livreur,
}: {
  action: (formData: FormData) => void;
  livreur?: Livreur;
}) {
  return (
    <form action={action} className="mt-6 grid max-w-lg gap-4">
      <div>
        <label className={labelClass}>Nom</label>
        <input name="name" required defaultValue={livreur?.name} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Téléphone / lien WhatsApp (https://wa.me/…)</label>
        <input name="phone" required defaultValue={livreur?.phone} className={inputClass} />
      </div>
      <label className="flex items-center gap-2 text-sm text-navy/70">
        <input type="checkbox" name="active" defaultChecked={livreur?.active ?? true} />
        Actif
      </label>
      <button
        type="submit"
        className="mt-2 w-fit rounded-full bg-navy px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-light"
      >
        {livreur ? "Enregistrer" : "Créer"}
      </button>
    </form>
  );
}
