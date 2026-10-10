import { auth } from "@/lib/auth";
import { WHATSAPP_CONTACTS, whatsappLink } from "@/lib/contact";

/** Page réservée aux revendeurs : message adapté si le compte revendeur n'a pas encore de fiche. */
export async function NotReseller() {
  const session = await auth();
  if (session?.user?.role === "CONSULTANT") {
    const c = WHATSAPP_CONTACTS[0];
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center sm:p-8">
        <p className="font-serif-display text-xl text-navy">Votre espace revendeur est presque prêt</p>
        <p className="mx-auto mt-2 max-w-lg text-sm text-navy/80">
          Votre compte est bien créé, mais il n&apos;est pas encore rattaché à votre fiche revendeur (lien personnel, équipe, wallet).
          L&apos;équipe JAMAAL vient d&apos;être prévenue et s&apos;en occupe. Revenez dans quelques instants, ou écrivez-nous.
        </p>
        <a href={whatsappLink(c.number, `Bonjour JAMAAL, mon compte revendeur (${session.user.email ?? ""}) n'est pas encore rattaché à ma fiche.`)} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800">
          Écrire à JAMAAL sur WhatsApp
        </a>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-line bg-white p-8 text-center">
      <p className="font-serif-display text-xl text-navy">Espace réservé aux consultants</p>
      <p className="mt-2 text-sm text-navy/75">
        Connectez-vous avec un compte consultant pour accéder à cette page. Les administrateurs gèrent le réseau depuis
        « Consultants ».
      </p>
    </div>
  );
}
