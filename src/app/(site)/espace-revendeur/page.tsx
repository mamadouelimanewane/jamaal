import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { auth, signIn } from "@/lib/auth";
import { BrandLogo } from "@/components/BrandLogo";

export const metadata: Metadata = {
  title: "Espace revendeur",
  robots: { index: false },
};

async function loginAction(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  try {
    await signIn("credentials", { email, password, redirectTo: "/admin" });
  } catch (error) {
    if (error instanceof AuthError) redirect("/espace-revendeur?erreur=1");
    throw error;
  }
}

const field =
  "mt-2 w-full rounded-xl border border-line bg-cream/50 px-4 py-3 text-sm outline-none transition focus:border-rose-dark focus:bg-white focus:ring-4 focus:ring-rose/10";

export default async function EspaceRevendeurPage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string }>;
}) {
  const { erreur } = await searchParams;
  const session = await auth();
  if (session) redirect("/admin");

  return (
    <div className="mx-auto max-w-md px-4 py-14 sm:px-6">
      <BrandLogo height={104} priority className="mx-auto mb-6" />
      <p className="luxury-eyebrow">Espace revendeur</p>
      <h1 className="mt-2 font-serif-display text-3xl font-semibold text-navy">Connexion</h1>
      <p className="mt-3 text-sm text-navy/70">
        Retrouvez vos commandes, votre lien de vente personnel, vos commissions, votre équipe et vos
        outils de vente.
      </p>

      {erreur && (
        <p role="alert" className="mt-5 rounded-xl border border-rose-dark/20 bg-rose/10 px-4 py-3 text-sm text-rose-dark">
          E-mail ou mot de passe incorrect.
        </p>
      )}

      <form action={loginAction} className="mt-6 flex flex-col gap-5 rounded-2xl border border-line bg-white p-6">
        <div>
          <label htmlFor="email" className="text-xs font-semibold text-navy/75">Adresse e-mail</label>
          <input id="email" name="email" type="email" required autoComplete="username" autoCapitalize="none" spellCheck={false} className={field} />
        </div>
        <div>
          <label htmlFor="password" className="text-xs font-semibold text-navy/75">Mot de passe</label>
          <input id="password" name="password" type="password" required autoComplete="current-password" className={field} />
        </div>
        <button type="submit" className="rounded-full bg-navy px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-navy-light">
          Accéder à mon espace
        </button>
        <Link href="/admin/forgot-password" className="text-center text-xs font-semibold text-rose-dark hover:underline">
          Mot de passe oublié ?
        </Link>
      </form>

      <p className="mt-6 text-center text-sm text-navy/60">
        Pas encore revendeur·se ?{" "}
        <Link href="/devenir-consultant" className="font-semibold text-rose-dark hover:underline">
          Postuler
        </Link>
      </p>
    </div>
  );
}
