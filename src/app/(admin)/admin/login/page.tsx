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
  const email = String(formData.get("email") ?? "");
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
  searchParams: Promise<{ erreur?: string; next?: string }>;
}) {
  const { erreur, next } = await searchParams;
  const redirectTo = safeRedirect(next);
  const isLivreurEntry = redirectTo === "/livreur";

  const session = await auth();
  if (session) redirect(redirectTo);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-white p-8 shadow-sm">
        <h1 className="font-serif-display text-2xl font-semibold text-navy">
          {isLivreurEntry ? "Espace Livreur JAMAAL" : "Back-office JAMAAL"}
        </h1>
        <p className="mt-1 text-sm text-navy/60">Connectez-vous pour continuer.</p>

        {erreur && (
          <p className="mt-4 rounded-lg bg-rose-light/40 px-3 py-2 text-sm text-rose-dark">
            E-mail ou mot de passe incorrect.
          </p>
        )}

        <form action={loginAction} className="mt-6 flex flex-col gap-4">
          <input type="hidden" name="next" value={redirectTo} />
          <div>
            <label className="text-xs font-medium text-navy/70">E-mail</label>
            <input
              type="email"
              name="email"
              required
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-navy"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-navy/70">Mot de passe</label>
            <input
              type="password"
              name="password"
              required
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-navy"
            />
          </div>
          <button
            type="submit"
            className="mt-2 rounded-full bg-navy py-2.5 text-sm font-semibold text-white transition hover:bg-navy-light"
          >
            Se connecter
          </button>
        </form>
      </div>
    </div>
  );
}
