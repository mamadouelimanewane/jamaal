import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { completePasswordReset, resetLinkState } from "@/lib/actions/password-reset";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token = "", error } = await searchParams;
  // Lien déjà utilisé ou expiré : on le dit tout de suite, avant de faire taper un mot de passe.
  const dead = error === "expired" || (await resetLinkState(token)) === "invalid";
  return <main className="flex min-h-screen items-center justify-center bg-[#f8f1ee] p-4"><section className="w-full max-w-md rounded-3xl border border-line bg-white p-8 shadow-xl">
    <Link href="/" aria-label="JAMAAL — accueil" className="inline-block"><BrandLogo height={84} /></Link>
    {dead ? <>
      <h1 className="mt-8 font-serif-display text-2xl font-semibold text-navy">Ce lien n&apos;est plus valable</h1>
      <p className="mt-3 text-sm leading-6 text-navy/75">Il a déjà servi (votre mot de passe est peut-être déjà choisi), ou il a expiré, ou un lien plus récent vous a été envoyé.</p>
      <div className="mt-6 grid gap-3">
        <Link href="/admin/login" className="rounded-full bg-navy px-5 py-3 text-center text-sm font-semibold text-white">J&apos;ai déjà un mot de passe : me connecter</Link>
        <Link href="/admin/forgot-password" className="rounded-full border border-navy/20 px-5 py-3 text-center text-sm font-semibold text-navy">Recevoir un nouveau lien (WhatsApp ou e-mail)</Link>
      </div>
      <p className="mt-4 text-xs leading-5 text-navy/60">Pour vous connecter, utilisez votre numéro WhatsApp (ex. 77 123 45 67) ou votre e-mail, avec le mot de passe que vous avez choisi.</p>
    </> : <>
      <h1 className="mt-8 font-serif-display text-2xl font-semibold text-navy">Choisir un nouveau mot de passe</h1>
      {error === "1" && <p role="alert" className="mt-4 rounded-xl bg-rose/10 p-3 text-sm text-rose-dark">Les deux mots de passe ne correspondent pas, ou le mot de passe fait moins de 8 caractères.</p>}
      <form action={completePasswordReset} className="mt-6 grid gap-4"><input type="hidden" name="token" value={token}/><label className="grid gap-2 text-xs font-semibold text-navy/85">Nouveau mot de passe (8 caractères minimum)<input name="password" type="password" minLength={8} maxLength={128} autoComplete="new-password" required className="rounded-xl border border-line px-4 py-3 text-sm"/></label><label className="grid gap-2 text-xs font-semibold text-navy/85">Confirmer le mot de passe<input name="confirmation" type="password" minLength={8} maxLength={128} autoComplete="new-password" required className="rounded-xl border border-line px-4 py-3 text-sm"/></label><button className="rounded-full bg-navy px-5 py-3 text-sm font-semibold text-white">Enregistrer le mot de passe</button></form>
      <Link href="/admin/login" className="mt-6 block text-center text-sm font-semibold text-rose-dark">Retour à la connexion</Link>
    </>}
  </section></main>;
}
