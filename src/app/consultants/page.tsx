import { consultants } from "@/data/consultants";

export default function ConsultantsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="font-serif-display text-3xl font-semibold text-navy">
        Nos consultant·es JAMAAL
      </h1>
      <p className="mt-3 text-sm text-navy/70">
        Retrouvez un·e consultant·e près de chez vous pour un conseil personnalisé.
      </p>
      <ul className="mt-8 flex flex-col gap-3">
        {consultants.map((c) => (
          <li
            key={c.name}
            className="flex items-center justify-between rounded-2xl border border-line bg-white p-4"
          >
            <div>
              <p className="font-semibold text-navy">{c.name}</p>
              <p className="text-xs text-navy/60">{c.city}</p>
            </div>
            <a href={c.whatsapp} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-rose-dark">
              Contacter →
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
