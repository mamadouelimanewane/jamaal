import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { requestPasswordReset } from "@/lib/actions/password-reset";
import { WHATSAPP_CONTACTS } from "@/lib/contact";

/** Numéro WhatsApp Business de JAMAAL (celui de l'API Meta) : un message « MOT DE PASSE » y reçoit le lien. */
const businessNumber = () => (process.env.WHATSAPP_BUSINESS_NUMBER ?? "").replace(/\D/g, "") || WHATSAPP_CONTACTS[0].number;

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  const { sent } = await searchParams;
  return <main className="flex min-h-screen items-center justify-center bg-[#f8f1ee] p-4"><section className="w-full max-w-md rounded-3xl border border-line bg-white p-8 shadow-xl">
    <Link href="/" aria-label="JAMAAL — accueil" className="inline-block"><BrandLogo height={84} /></Link>
    <h1 className="mt-8 font-serif-display text-2xl font-semibold text-navy">Mot de passe oublié</h1>
    <p className="mt-2 text-sm leading-6 text-navy/75">Saisissez votre numéro WhatsApp (revendeurs, livreurs) ou l’adresse e-mail de votre compte. Vous recevrez un lien pour choisir un nouveau mot de passe.</p>
    {sent === "wa" && <p role="status" className="mt-5 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">Si ce numéro correspond à un compte, le lien arrive sur son WhatsApp dans un instant (valable 24 h). Rien reçu ? Utilisez le bouton WhatsApp ci-dessous : l’équipe JAMAAL est aussi prévenue et peut vous envoyer un lien.</p>}
    {sent && sent !== "wa" && <p role="status" className="mt-5 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">Si un compte correspond à cette adresse, un e-mail de réinitialisation va être envoyé.</p>}
    <form action={requestPasswordReset} className="mt-6 grid gap-3"><label htmlFor="email" className="text-xs font-semibold text-navy/85">Numéro WhatsApp ou e-mail</label><input id="email" name="email" type="text" inputMode="email" required autoComplete="username" placeholder="77 123 45 67 ou nom@exemple.com" className="rounded-xl border border-line px-4 py-3 text-sm"/><button className="rounded-full bg-navy px-5 py-3 text-sm font-semibold text-white">Envoyer le lien</button></form>
    <div className="mt-7 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
      <p className="font-semibold">Le plus rapide : depuis votre WhatsApp</p>
      <p className="mt-1 text-emerald-900/85">Envoyez « MOT DE PASSE » à JAMAAL depuis le numéro de votre compte : le lien arrive en réponse, dans la même discussion.</p>
      <a href={`https://wa.me/${businessNumber()}?text=${encodeURIComponent("MOT DE PASSE")}`} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex w-full items-center justify-center rounded-full bg-[#25D366] px-5 py-3 font-semibold text-white hover:bg-[#1ebe5b]">Ouvrir WhatsApp et envoyer « MOT DE PASSE »</a>
    </div>
    <Link href="/admin/login" className="mt-6 block text-center text-sm font-semibold text-rose-dark">Retour à la connexion</Link>
  </section></main>;
}
