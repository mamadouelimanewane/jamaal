import { BrandLogo } from "@/components/BrandLogo";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { StaffLoginForm, type LoginNotice } from "@/components/StaffLoginForm";
import { InstallGuide } from "@/components/admin/InstallGuide";

const ALLOWED_REDIRECTS = new Set(["/admin", "/livreur"]);

function safeRedirect(next: string | undefined): string {
  if (next && ALLOWED_REDIRECTS.has(next)) return next;
  return "/admin";
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<LoginNotice & { next?: string }>;
}) {
  const notice = await searchParams;
  const { next } = notice;
  const redirectTo = safeRedirect(next);
  const isLivreurEntry = redirectTo === "/livreur";

  const session = await auth();
  if (session) redirect(redirectTo);

  return (
    <main className="min-h-screen bg-[#f8f1ee] p-4 sm:p-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl overflow-hidden rounded-[2rem] border border-line bg-white shadow-2xl shadow-navy/10 lg:grid-cols-[1.05fr_.95fr]">
        <section className="relative hidden overflow-hidden bg-[#111b2b] p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
          <div aria-hidden="true" className="absolute -right-24 top-16 h-96 w-96 rounded-full border border-white/10" />
          <div aria-hidden="true" className="absolute -right-12 top-28 h-72 w-72 rounded-full border border-white/10" />
          <Link href="/" className="relative inline-flex w-fit items-center gap-3">
            <span className="rounded-2xl bg-white p-3">
              <BrandLogo height={112} priority />
            </span>
          </Link>
          <div className="relative max-w-md">
            <p className="text-xs uppercase tracking-[0.28em] text-[#eac2b6]">Espace sécurisé</p>
            <h1 className="mt-4 font-serif-display text-4xl font-medium leading-tight xl:text-5xl">
              L’excellence JAMAAL, au quotidien.
            </h1>
            <p className="mt-5 text-sm leading-7 text-white/65">
              {isLivreurEntry
                ? "Retrouvez vos tournées, vos livraisons et les informations utiles à votre journée."
                : "Retrouvez votre espace de travail et les outils pour faire grandir l’univers JAMAAL."}
            </p>
          </div>
          <p className="relative text-xs tracking-wide text-white/70">JAMAAL Luxury Cosmetics</p>
        </section>

        <section className="flex items-center justify-center px-5 py-12 sm:px-10 lg:px-12">
          <div className="w-full max-w-md">
            <Link href="/" className="mb-8 inline-flex items-center gap-3 lg:hidden">
              <BrandLogo height={88} priority />
            </Link>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-rose-dark">
              {isLivreurEntry ? "Espace livraison" : "Espace équipe"}
            </p>
            <h2 className="mt-3 font-serif-display text-3xl font-semibold text-navy">
              {isLivreurEntry ? "Bienvenue" : "Connexion"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-navy/75">
              Revendeurs et livreurs : votre numéro WhatsApp et votre mot de passe, ou un lien reçu sur WhatsApp.
            </p>

            <StaffLoginForm from="/admin/login" next={redirectTo} notice={notice} />
            {(notice as { reset?: string }).reset === "1" ? (
              <div className="mt-6 rounded-2xl border border-line bg-[#fdfbfa] p-4">
                <p className="text-sm font-semibold text-navy">📲 Gardez JAMAAL sur votre téléphone</p>
                <p className="mb-3 mt-1 text-xs text-navy/70">Installez l&apos;application : votre espace s&apos;ouvrira d&apos;un geste, avec l&apos;icône JAMAAL.</p>
                <InstallGuide compact />
              </div>
            ) : (
              <Link href="/admin/installer" className="mt-4 block text-center text-sm font-semibold text-rose-dark">📲 Installer l&apos;application JAMAAL sur mon téléphone</Link>
            )}
            <p className="mt-6 text-center text-xs text-navy/70">
              Besoin d’aide pour vous connecter ? Contactez votre administrateur.
            </p>
            <p className="mt-2 text-center text-[11px] text-navy/40">Version {(process.env.VERCEL_GIT_COMMIT_SHA ?? "locale").slice(0, 7)}</p>
          </div>
        </section>
      </div>
    </main>
  );
}
