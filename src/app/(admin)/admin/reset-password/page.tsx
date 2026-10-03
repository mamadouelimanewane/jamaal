import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { completePasswordReset } from "@/lib/actions/password-reset";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token = "", error } = await searchParams;
  return <main className="flex min-h-screen items-center justify-center bg-[#f8f1ee] p-4"><section className="w-full max-w-md rounded-3xl border border-line bg-white p-8 shadow-xl">
    <Link href="/" aria-label="JAMAAL — accueil" className="inline-block"><BrandLogo height={84} /></Link>
    <h1 className="mt-8 font-serif-display text-2xl font-semibold text-navy">Choisir un nouveau mot de passe</h1>
    {error && <p role="alert" className="mt-4 rounded-xl bg-rose/10 p-3 text-sm text-rose-dark">Le lien est invalide ou expiré, ou les mots de passe ne correspondent pas.</p>}
    <form action={completePasswordReset} className="mt-6 grid gap-4"><input type="hidden" name="token" value={token}/><label className="grid gap-2 text-xs font-semibold text-navy/70">Nouveau mot de passe (12 caractères minimum)<input name="password" type="password" minLength={12} maxLength={128} autoComplete="new-password" required className="rounded-xl border border-line px-4 py-3 text-sm"/></label><label className="grid gap-2 text-xs font-semibold text-navy/70">Confirmer le mot de passe<input name="confirmation" type="password" minLength={12} maxLength={128} autoComplete="new-password" required className="rounded-xl border border-line px-4 py-3 text-sm"/></label><button className="rounded-full bg-navy px-5 py-3 text-sm font-semibold text-white">Enregistrer le mot de passe</button></form>
    <Link href="/admin/login" className="mt-6 block text-center text-sm font-semibold text-rose-dark">Retour à la connexion</Link>
  </section></main>;
}
