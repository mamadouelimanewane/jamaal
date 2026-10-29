"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Lock } from "lucide-react";
import { useInstall } from "@/components/admin/InstallApp";
import { InstallGuide } from "@/components/admin/InstallGuide";
import { registerLivreur, type SignupState } from "@/lib/actions/livreur-signup";
import { PAYOUT_PROVIDERS, VEHICLES } from "@/lib/livreur-signup";

const field = "mt-1.5 w-full rounded-xl border border-line bg-cream/50 px-4 py-3 text-base text-navy outline-none transition focus:border-rose-dark focus:bg-white focus:ring-4 focus:ring-rose/10";
const label = "block text-left text-xs font-semibold text-navy/85";

/**
 * Application JAMAAL Livreur. Installation obligatoire : dans le navigateur, seul le guide d'installation
 * s'affiche. Ouverte depuis l'icône (mode application) : inscription ou connexion ; un livreur déjà
 * connecté part directement sur ses livraisons.
 */
export function LivreurApp({ loggedIn, initialTab, login }: { loggedIn: boolean; initialTab: "signup" | "login"; login: React.ReactNode }) {
  const { installed } = useInstall();
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState(initialTab);
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 0);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (ready && installed && loggedIn) router.replace("/admin/mes-livraisons");
  }, [ready, installed, loggedIn, router]);

  if (!ready) return <div className="h-40" aria-hidden="true" />;

  if (!installed)
    return (
      <div>
        <h1 className="font-serif-display text-2xl font-semibold text-navy">Installez l&apos;application Livreur</h1>
        <p className="mt-2 text-sm leading-6 text-navy/75">
          Pour livrer avec JAMAAL, l&apos;application est obligatoire : vos courses, l&apos;itinéraire, la confirmation de livraison et vos gains, sur votre téléphone.
        </p>
        <p className="mx-auto mt-3 flex w-fit items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">
          <Lock size={13} /> {loggedIn ? "Installez l'application pour accéder à vos livraisons" : "L'inscription s'ouvre dans l'application"}
        </p>
        <div className="mt-5"><InstallGuide next="/admin/livreur" compact /></div>
        <p className="mt-4 text-xs text-navy/60">Ensuite, ouvrez <strong>JAMAAL Livreur</strong> depuis l&apos;icône de votre écran d&apos;accueil. Gratuit, sans Play Store ni App Store.</p>
      </div>
    );

  if (loggedIn) return <p className="py-10 text-sm text-navy/70">Ouverture de vos livraisons…</p>;

  return (
    <div>
      <div role="tablist" aria-label="Inscription ou connexion" className="grid grid-cols-2 gap-1 rounded-full bg-cream p-1 text-sm font-semibold">
        <button type="button" role="tab" aria-selected={tab === "signup"} onClick={() => setTab("signup")} className={`rounded-full px-3 py-2.5 ${tab === "signup" ? "bg-navy text-white" : "text-navy"}`}>Je m&apos;inscris</button>
        <button type="button" role="tab" aria-selected={tab === "login"} onClick={() => setTab("login")} className={`rounded-full px-3 py-2.5 ${tab === "login" ? "bg-navy text-white" : "text-navy"}`}>J&apos;ai déjà un compte</button>
      </div>
      {tab === "signup" ? <SignupForm onLogin={() => setTab("login")} /> : <div className="text-left">{login}</div>}
    </div>
  );
}

function SignupForm({ onLogin }: { onLogin: () => void }) {
  const [state, action, pending] = useActionState<SignupState, FormData>(registerLivreur, null);
  const [provider, setProvider] = useState(state?.values?.walletProvider || "WAVE");

  if (state?.ok)
    return (
      <div className="mt-6 rounded-2xl bg-emerald-50 p-5 text-sm text-emerald-900">
        <CheckCircle2 className="mx-auto" size={32} />
        <p className="mt-2 text-base font-semibold">Merci{state.name ? ` ${state.name}` : ""}, inscription reçue !</p>
        <p className="mt-1 leading-6">L&apos;équipe JAMAAL vérifie votre dossier. Vous serez prévenu sur WhatsApp dès la validation, puis vous vous connecterez avec votre numéro et votre mot de passe.</p>
        <button type="button" onClick={onLogin} className="mt-4 rounded-full border border-emerald-800/30 px-5 py-2.5 font-semibold">Se connecter</button>
      </div>
    );

  const err = (f: string) => (state && !state.ok && state.field === f ? true : undefined);
  const v = (k: string) => state?.values?.[k] ?? "";
  return (
    <form key={state?.n ?? 0} action={action} className="mt-5 flex flex-col gap-4 text-left" noValidate>
      <h1 className="text-center font-serif-display text-xl font-semibold text-navy">Devenir livreur JAMAAL</h1>
      {state && !state.ok && <p role="alert" className="rounded-xl border border-rose-dark/20 bg-rose/10 px-4 py-3 text-sm text-rose-dark">{state.error}</p>}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      <div>
        <label htmlFor="lv-name" className={label}>Prénom et nom</label>
        <input id="lv-name" name="name" defaultValue={v("name")} required autoComplete="name" aria-invalid={err("name")} className={field} />
      </div>
      <div>
        <label htmlFor="lv-phone" className={label}>Numéro WhatsApp</label>
        <input id="lv-phone" name="phone" defaultValue={v("phone")} type="tel" inputMode="tel" required placeholder="77 123 45 67" autoComplete="tel" aria-invalid={err("phone")} className={field} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="lv-pass" className={label}>Mot de passe</label>
          <input id="lv-pass" name="password" type="password" required minLength={8} autoComplete="new-password" aria-invalid={err("password")} aria-describedby="lv-pass-hint" className={field} />
        </div>
        <div>
          <label htmlFor="lv-confirm" className={label}>Confirmer</label>
          <input id="lv-confirm" name="confirm" type="password" required autoComplete="new-password" aria-invalid={err("confirm")} className={field} />
        </div>
      </div>
      <p id="lv-pass-hint" className="-mt-2 text-xs text-navy/60">8 caractères minimum, avec des lettres et au moins un chiffre.</p>
      <div>
        <label htmlFor="lv-zone" className={label}>Quartiers / zone de livraison</label>
        <input id="lv-zone" name="zone" defaultValue={v("zone")} required placeholder="Ex. Plateau, Médina, Fann" aria-invalid={err("zone")} className={field} />
      </div>
      <fieldset aria-invalid={err("vehicle")}>
        <legend className={label}>Moyen de déplacement</legend>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {VEHICLES.map((veh, i) => (
            <label key={veh.id} className="cursor-pointer">
              <input type="radio" name="vehicle" value={veh.id} defaultChecked={v("vehicle") ? v("vehicle") === veh.id : i === 0} className="peer sr-only" />
              <span className="inline-block rounded-full border border-line px-4 py-2 text-sm text-navy peer-checked:border-navy peer-checked:bg-navy peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-rose-dark">{veh.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[auto_1fr]">
        <div>
          <label htmlFor="lv-provider" className={label}>Paiement de vos gains</label>
          <select id="lv-provider" name="walletProvider" value={provider} onChange={(e) => setProvider(e.target.value)} className={field}>
            {PAYOUT_PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="lv-wallet" className={label}>Numéro {provider === "WAVE" ? "Wave" : "Orange Money"}</label>
          <input id="lv-wallet" name="walletNumber" defaultValue={v("walletNumber")} type="tel" inputMode="tel" placeholder="Laisser vide = n° WhatsApp" aria-invalid={err("walletNumber")} className={field} />
        </div>
      </div>
      <div>
        <label htmlFor="lv-id" className={label}>N° de pièce d&apos;identité <span className="font-normal text-navy/55">(facultatif)</span></label>
        <input id="lv-id" name="idNumber" defaultValue={v("idNumber")} autoComplete="off" className={field} />
      </div>
      <details className="rounded-xl bg-cream/70 p-3 text-xs leading-5 text-navy/80">
        <summary className="cursor-pointer font-semibold text-navy">Lire la charte du livreur JAMAAL</summary>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          <li>Je livre les colis intacts, dans les délais annoncés, et je préviens le client avant d&apos;arriver.</li>
          <li>J&apos;encaisse uniquement les montants affichés dans l&apos;application et je les reverse sans délai.</li>
          <li>Je confirme chaque livraison dans l&apos;application (code ou photo) et je partage ma position pendant les tournées.</li>
          <li>Je reste courtois, je respecte la confidentialité des clients et le code de la route.</li>
          <li>JAMAAL peut suspendre mon compte en cas de manquement.</li>
        </ul>
      </details>
      <label className="flex items-start gap-3 text-sm text-navy">
        <input type="checkbox" name="charte" required aria-invalid={err("charte")} className="mt-0.5 h-5 w-5 shrink-0 accent-navy" />
        <span>J&apos;accepte la charte du livreur JAMAAL.</span>
      </label>
      <button type="submit" disabled={pending} className="rounded-full bg-rose-dark px-6 py-3.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60">
        {pending ? "Envoi…" : "Envoyer mon inscription"}
      </button>
      <p className="text-center text-xs text-navy/60">Votre compte s&apos;ouvre après validation par l&apos;équipe JAMAAL.</p>
    </form>
  );
}
