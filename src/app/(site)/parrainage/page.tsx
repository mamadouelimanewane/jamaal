import { Gift, Users } from "lucide-react";

export default function ParrainagePage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose/20">
          <Gift size={32} className="text-rose-dark" />
        </div>
        <h1 className="font-serif-display text-3xl font-bold text-navy">Programme Ambassadeur</h1>
        <p className="mt-2 text-navy/60">
          Le programme de parrainage est réservé aux consultants JAMAAL. Les conditions de récompense sont affichées dans leur espace.
        </p>
      </div>
      <div className="rounded-2xl border border-line bg-white p-6 text-center shadow-sm">
        <Users size={28} className="mx-auto mb-3 text-rose-dark" />
        <p className="font-semibold text-navy">Vous êtes consultant(e) ?</p>
        <p className="mt-2 text-sm text-navy/60">
          Connectez-vous à votre espace revendeur pour consulter votre code ambassadeur.
        </p>
        <a href="/admin" className="mt-5 inline-flex rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-white">
          Accéder à mon espace
        </a>
      </div>
    </div>
  );
}
