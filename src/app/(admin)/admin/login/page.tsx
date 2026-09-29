import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signIn, auth } from "@/lib/auth";
import { AuthError } from "next-auth";

const ALLOWED_REDIRECTS = new Set(["/admin", "/livreur"]);

function safeRedirect(next: string | undefined): string {
  if (next && ALLOWED_REDIRECTS.has(next)) return next;
  return "/admin";
}

async function loginAction(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectTo = safeRedirect(String(formData.get("next") ?? ""));
  try {
    await signIn("credentials", { email, password, redirectTo });
  } catch (error) {
    if (error instanceof AuthError) {
      const suffix = redirectTo !== "/admin" ? `&next=${encodeURIComponent(redirectTo)}` : "";
      redirect(`/admin/login?erreur=1${suffix}`);
    }
    throw error;
  }
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string; next?: string; reset?: string }>;
}) {
  const { erreur, next, reset } = await searchParams;
  const redirectTo = safeRedirect(next);
  const isLivreurEntry = redirectTo === "/livreur";

  const session = await auth();
  if (session) redirect(redirectTo);

  return (
    <main className="min-h-screen bg-[#f5f1eb] p-4 sm:p-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl overflow-hidden rounded-[2rem] border border-line bg-white shadow-2xl shadow-navy/10 lg:grid-cols-[1.05fr_.95fr]">
        <section className="relative hidden overflow-hidden bg-[#111b2b] p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
          <div aria-hidden="true" className="absolute -right-24 top-16 h-96 w-96 rounded-full border border-white/10" />
          <div aria-hidden="true" className="absolute -right-12 top-28 h-72 w-72 rounded-full border border-white/10" />
          <Link href="/" className="relative inline-flex w-fit items-center gap-3">
            <Image
              src="/logo/jamaal-logo.jpg"
              alt=""
              width={46}
              height={46}
              className="rounded-full ring-1 ring-white/40"
              priority
            />
            <span className="font-serif-display text-2xl font-semibold tracking-[0.16em]">JAMAAL</span>
          </Link>
          <div className="relative max-w-md">
            <p className="text-[10px] uppercase tracking-[0.28em] text-[#e4c4ab]">Espace sécurisé</p>
            <h1 className="mt-4 font-serif-display text-4xl font-medium leading-tight xl:text-5xl">
              L’excellence JAMAAL, au quotidien.
            </h1>
            <p className="mt-5 text-sm leading-7 text-white/65">
              {isLivreurEntry
                ? "Retrouvez vos tournées, vos livraisons et les informations utiles à votre journée."
                : "Retrouvez votre espace de travail et les outils pour faire grandir l’univers JAMAAL."}
            </p>
          </div>
          <p className="relative text-xs tracking-wide text-white/45">JAMAAL Luxury Cosmetics</p>
        </section>

        <section className="flex items-center justify-center px-5 py-12 sm:px-10 lg:px-12">
          <div className="w-full max-w-md">
            <Link href="/" className="mb-8 inline-flex items-center gap-3 lg:hidden">
              <Image src="/logo/jamaal-logo.jpg" alt="" width={40} height={40} className="rounded-full" />
              <span className="font-serif-display text-xl font-semibold tracking-[0.14em] text-navy">JAMAAL</span>
            </Link>
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-rose-dark">
              {isLivreurEntry ? "Espace livraison" : "Espace équipe"}
            </p>
            <h2 className="mt-3 font-serif-display text-3xl font-semibold text-navy">
              {isLivreurEntry ? "Bienvenue" : "Connexion"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-navy/60">
              Connectez-vous avec les identifiants de votre compte JAMAAL.
            </p>

            {reset && <p role="status" className="mt-5 rounded-xl border border-emerald-700/20 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Mot de passe mis à jour. Vous pouvez vous connecter.</p>}

            {erreur && (
              <p role="alert" className="mt-5 rounded-xl border border-rose-dark/20 bg-rose/10 px-4 py-3 text-sm text-rose-dark">
                E-mail ou mot de passe incorrect.
              </p>
            )}

            <form action={loginAction} className="mt-7 flex flex-col gap-5">
              <input type="hidden" name="next" value={redirectTo} />
              <div>
                <label htmlFor="email" className="text-xs font-semibold text-navy/75">Adresse e-mail</label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  className="mt-2 w-full rounded-xl border border-line bg-cream/50 px-4 py-3 text-sm outline-none transition focus:border-rose-dark focus:bg-white focus:ring-4 focus:ring-rose/10"
                />
              </div>
              <div>
                <label htmlFor="password" className="text-xs font-semibold text-navy/75">Mot de passe</label>
                <input
                  id="password"
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  required
                  className="mt-2 w-full rounded-xl border border-line bg-cream/50 px-4 py-3 text-sm outline-none transition focus:border-rose-dark focus:bg-white focus:ring-4 focus:ring-rose/10"
                />
              </div>
              <button
                type="submit"
                className="mt-1 rounded-full bg-navy px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-navy-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-dark"
              >
                Se connecter
              </button>
            </form>
            <Link href="/admin/forgot-password" className="mt-5 block text-center text-xs font-semibold text-rose-dark hover:underline">Mot de passe oublié ?</Link>
            <p className="mt-6 text-center text-xs text-navy/45">
              Besoin d’aide pour vous connecter ? Contactez votre administrateur.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
