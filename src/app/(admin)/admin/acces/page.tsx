import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
import { BrandLogo } from "@/components/BrandLogo";

export const dynamic = "force-dynamic";

async function openAction(formData: FormData) {
  "use server";
  const token = String(formData.get("token") ?? "");
  try {
    await signIn("magic", { token, redirectTo: "/admin" });
  } catch (error) {
    if (error instanceof AuthError) redirect("/admin/acces?erreur=1");
    throw error;
  }
}

/**
 * Page d'arrivée du lien de connexion WhatsApp. La connexion se fait au CLIC sur le bouton (POST) et
 * non à l'ouverture de la page : WhatsApp ouvre les liens pour fabriquer un aperçu, ce qui
 * consommerait sinon le lien à usage unique avant le revendeur.
 */
export default async function AccesPage({ searchParams }: { searchParams: Promise<{ token?: string; erreur?: string }> }) {
  const { token, erreur } = await searchParams;
  const invalid = !!erreur || !token;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f8f1ee] p-4">
      <section className="w-full max-w-md rounded-3xl border border-line bg-white p-8 text-center shadow-xl shadow-navy/10">
        <BrandLogo height={104} priority className="mx-auto" />
        <h1 className="mt-6 font-serif-display text-2xl font-semibold text-navy">
          {invalid ? "Lien expiré ou déjà utilisé" : "Ouvrir mon espace JAMAAL"}
        </h1>
        {invalid ? (
          <p className="mt-3 text-sm leading-6 text-navy/60">
            Ce lien de connexion ne fonctionne plus (il est valable 24 h et ne sert qu&apos;une fois). Demandez-en un nouveau à l&apos;équipe JAMAAL sur WhatsApp,
            ou connectez-vous avec votre mot de passe.
          </p>
        ) : (
          <>
            <p className="mt-3 text-sm leading-6 text-navy/60">Appuyez sur le bouton pour accéder à votre espace, sans mot de passe.</p>
            <form action={openAction} className="mt-6">
              <input type="hidden" name="token" value={token} />
              <button type="submit" className="w-full rounded-full bg-navy px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-navy-light">
                Ouvrir mon espace
              </button>
            </form>
          </>
        )}
        <a href="/espace-revendeur" className="mt-5 block text-xs font-semibold text-rose-dark hover:underline">Connexion avec mot de passe</a>
      </section>
    </main>
  );
}
