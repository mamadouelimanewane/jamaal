import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { requestPasswordReset } from "@/lib/actions/password-reset";

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  const { sent } = await searchParams;
  return <main className="flex min-h-screen items-center justify-center bg-[#f8f1ee] p-4"><section className="w-full max-w-md rounded-3xl border border-line bg-white p-8 shadow-xl">
    <Link href="/" aria-label="JAMAAL — accueil" className="inline-block"><BrandLogo height={84} /></Link>
    <h1 className="mt-8 font-serif-display text-2xl font-semibold text-navy">Réinitialiser le mot de passe</h1>
    <p className="mt-2 text-sm leading-6 text-navy/60">Saisissez l’adresse e-mail associée à votre compte. Si elle existe, vous recevrez un lien valable une heure.</p>
    {sent && <p role="status" className="mt-5 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">Si un compte correspond à cette adresse, un e-mail de réinitialisation va être envoyé.</p>}
    <form action={requestPasswordReset} className="mt-6 grid gap-3"><label htmlFor="email" className="text-xs font-semibold text-navy/70">Adresse e-mail</label><input id="email" name="email" type="email" required autoComplete="email" className="rounded-xl border border-line px-4 py-3 text-sm"/><button className="rounded-full bg-navy px-5 py-3 text-sm font-semibold text-white">Envoyer le lien</button></form>
    <Link href="/admin/login" className="mt-6 block text-center text-sm font-semibold text-rose-dark">Retour à la connexion</Link>
  </section></main>;
}
