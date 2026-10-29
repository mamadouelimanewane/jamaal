"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, CheckCircle2, FileText, Lock } from "lucide-react";
import { compressPhoto } from "@/lib/compress-photo";
import { useInstall } from "@/components/admin/InstallApp";
import { InstallGuide } from "@/components/admin/InstallGuide";
import { QRCodeSVG } from "qrcode.react";
import { installEnv, type InstallEnv } from "@/lib/install-env";
import { registerLivreur, type SignupState } from "@/lib/actions/livreur-signup";
import { DOC_MAX_BYTES, ID_TYPES, PAYOUT_PROVIDERS, VEHICLES, needsVerso } from "@/lib/livreur-signup";

const field = "mt-1.5 w-full rounded-xl border border-line bg-cream/50 px-4 py-3 text-base text-navy outline-none transition focus:border-rose-dark focus:bg-white focus:ring-4 focus:ring-rose/10";
const label = "block text-left text-xs font-semibold text-navy/85";

/** « 221771234567 » → « 77 123 45 67 » (affichage de l'identifiant). */
export function prettyPhone(p: string) {
  const d = p.replace(/\D/g, "");
  const local = d.startsWith("221") && d.length === 12 ? d.slice(3) : d;
  return local.length === 9 ? `${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5, 7)} ${local.slice(7)}` : p;
}

/**
 * Application JAMAAL Livreur, à l'adresse d'inscription des livreurs.
 * - Sur téléphone, dans le navigateur : 1. installation directe de l'icône « JAMAAL Livreur »,
 *   2. inscription complète (le numéro WhatsApp sert d'identifiant), 3. validation par l'équipe JAMAAL.
 * - Sur ordinateur : code QR pour ouvrir la page sur le téléphone (l'inscription reste possible).
 * - Ouverte depuis l'icône : inscription ou connexion ; un livreur connecté part sur ses livraisons.
 * Les livraisons elles-mêmes ne s'utilisent que dans l'application installée.
 */
export function LivreurApp({ loggedIn, initialTab, login }: { loggedIn: boolean; initialTab: "signup" | "login"; login: React.ReactNode }) {
  const { installed } = useInstall();
  const [env, setEnv] = useState<InstallEnv | null>(null);
  const [tab, setTab] = useState(initialTab);
  const [url, setUrl] = useState("");
  const router = useRouter();

  useEffect(() => {
    const e = installEnv(navigator.userAgent, navigator.maxTouchPoints, navigator.platform);
    const t = setTimeout(() => {
      setEnv(e);
      setUrl(`${window.location.origin}/livreur`);
    }, 0);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (env && installed && loggedIn) router.replace("/admin/mes-livraisons");
  }, [env, installed, loggedIn, router]);

  if (!env) return <div className="h-40" aria-hidden="true" />;
  const mobile = env !== "desktop";

  if (loggedIn && !installed)
    return (
      <div>
        <h1 className="font-serif-display text-2xl font-semibold text-navy">Installez l&apos;application Livreur</h1>
        <p className="mx-auto mt-3 flex w-fit items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900"><Lock size={13} /> Obligatoire pour accéder à vos livraisons</p>
        <div className="mt-5"><InstallGuide next="/admin/livreur" compact appName="JAMAAL Livreur" /></div>
        <p className="mt-4 text-xs text-navy/60">Ensuite, ouvrez <strong>JAMAAL Livreur</strong> depuis l&apos;icône de votre écran d&apos;accueil.</p>
      </div>
    );
  if (loggedIn) return <p className="py-10 text-sm text-navy/70">Ouverture de vos livraisons…</p>;

  return (
    <div>
      {!installed && (
        <>
          <h1 className="font-serif-display text-2xl font-semibold text-navy">Devenez livreur JAMAAL</h1>
          <ol className="mt-4 grid grid-cols-3 gap-2 text-left text-[11px] font-semibold leading-4 text-navy/80" aria-label="Étapes">
            {["Installer l'application", "S'inscrire avec son numéro", "Validation par JAMAAL"].map((t, i) => (
              <li key={t} className="flex items-start gap-1.5 rounded-xl bg-cream/70 p-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-navy text-[11px] text-white">{i + 1}</span>
                {t}
              </li>
            ))}
          </ol>
          {mobile ? (
            <section className="mt-4 rounded-2xl border border-line bg-[#fdfbfa] p-4 text-left" aria-labelledby="lv-install-title">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icons/livreur-192.png" alt="" width={52} height={52} className="rounded-xl border border-line" />
                <div>
                  <h2 id="lv-install-title" className="font-semibold text-navy">1. Installez JAMAAL Livreur</h2>
                  <p className="text-xs text-navy/70">L&apos;icône s&apos;ajoute sur votre écran d&apos;accueil, comme une application. Gratuit, sans Play Store.</p>
                </div>
              </div>
              <div className="mt-3"><InstallGuide next="/admin/livreur" compact appName="JAMAAL Livreur" /></div>
            </section>
          ) : (
            <section className="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-line bg-[#fdfbfa] p-4 sm:flex-row sm:text-left" aria-labelledby="lv-qr-title">
              {url && <QRCodeSVG value={url} size={128} level="M" className="shrink-0 rounded-lg bg-white p-1.5" aria-label="Code QR de l'inscription livreur" />}
              <div>
                <h2 id="lv-qr-title" className="font-semibold text-navy">Ouvrez cette page sur votre téléphone</h2>
                <p className="mt-1 text-sm text-navy/75">Scannez le code avec l&apos;appareil photo : l&apos;application JAMAAL Livreur s&apos;installe directement sur le téléphone. Vous pouvez aussi remplir l&apos;inscription ici.</p>
              </div>
            </section>
          )}
        </>
      )}

      <div role="tablist" aria-label="Inscription ou connexion" className="mt-5 grid grid-cols-2 gap-1 rounded-full bg-cream p-1 text-sm font-semibold">
        <button type="button" role="tab" aria-selected={tab === "signup"} onClick={() => setTab("signup")} className={`rounded-full px-3 py-2.5 ${tab === "signup" ? "bg-navy text-white" : "text-navy"}`}>{installed ? "Je m'inscris" : "2. Je m'inscris"}</button>
        <button type="button" role="tab" aria-selected={tab === "login"} onClick={() => setTab("login")} className={`rounded-full px-3 py-2.5 ${tab === "login" ? "bg-navy text-white" : "text-navy"}`}>J&apos;ai déjà un compte</button>
      </div>
      {tab === "signup" ? <SignupForm onLogin={() => setTab("login")} installed={installed} /> : <div className="text-left">{login}</div>}
    </div>
  );
}

function SignupForm({ onLogin, installed }: { onLogin: () => void; installed: boolean }) {
  const [state, action, pending] = useActionState<SignupState, FormData>(registerLivreur, null);
  const [provider, setProvider] = useState(state?.values?.walletProvider || "WAVE");
  const [idType, setIdType] = useState(state?.values?.idType || "CNI");
  const [recto, setRecto] = useState<File | null>(null);
  const [verso, setVerso] = useState<File | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLocalError(null);
    if (!recto) return setLocalError("Ajoutez la photo de votre pièce d'identité (recto).");
    if (needsVerso(idType) && !verso) return setLocalError("Ajoutez aussi la photo du verso de votre pièce.");
    const fd = new FormData(e.currentTarget);
    fd.set("idRecto", recto);
    if (needsVerso(idType) && verso) fd.set("idVerso", verso);
    startTransition(() => action(fd));
  }

  if (state?.ok)
    return (
      <div className="mt-6 space-y-4 text-left">
        <div className="rounded-2xl bg-emerald-50 p-5 text-sm text-emerald-900">
          <CheckCircle2 className="mx-auto" size={32} />
          <p className="mt-2 text-center text-base font-semibold">Merci{state.name ? ` ${state.name}` : ""}, inscription reçue !</p>
          {state.phone && (
            <p className="mt-3 rounded-xl bg-white/70 px-3 py-2 text-center">
              Votre identifiant : <strong className="text-base tracking-wide">{prettyPhone(state.phone)}</strong>
              <span className="block text-xs text-emerald-900/80">avec le mot de passe que vous venez de choisir</span>
            </p>
          )}
          <p className="mt-3 leading-6"><strong>3. Validation :</strong> l&apos;équipe JAMAAL vérifie votre pièce d&apos;identité. Vous recevez un message WhatsApp dès que votre compte est activé.</p>
        </div>
        {!installed ? (
          <p className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
            <strong>Dernière étape :</strong> si ce n&apos;est pas encore fait, ajoutez l&apos;icône <strong>JAMAAL Livreur</strong> sur votre téléphone (étape 1 ci-dessus). C&apos;est avec elle que vous vous connecterez après la validation.
          </p>
        ) : (
          <button type="button" onClick={onLogin} className="w-full rounded-full border border-emerald-800/30 px-5 py-2.5 font-semibold text-emerald-900">Se connecter</button>
        )}
      </div>
    );

  const err = (f: string) => (state && !state.ok && state.field === f ? true : undefined);
  const v = (k: string) => state?.values?.[k] ?? "";
  return (
    <form key={state?.n ?? 0} onSubmit={submit} className="mt-5 flex flex-col gap-4 text-left" noValidate>
      <h1 className="text-center font-serif-display text-xl font-semibold text-navy">Devenir livreur JAMAAL</h1>
      {(localError || (state && !state.ok)) && <p role="alert" className="rounded-xl border border-rose-dark/20 bg-rose/10 px-4 py-3 text-sm text-rose-dark">{localError ?? state?.error}</p>}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
      <div>
        <label htmlFor="lv-name" className={label}>Prénom et nom</label>
        <input id="lv-name" name="name" defaultValue={v("name")} required autoComplete="name" aria-invalid={err("name")} className={field} />
      </div>
      <div>
        <label htmlFor="lv-phone" className={label}>Numéro WhatsApp <span className="font-normal text-navy/60">· ce sera votre identifiant de connexion</span></label>
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
      <fieldset className="rounded-2xl border border-line p-3">
        <legend className="px-1 text-sm font-semibold text-navy">Pièce d&apos;identité <span className="font-normal text-rose-dark">(obligatoire)</span></legend>
        <label htmlFor="lv-idtype" className={label}>Type de pièce</label>
        <select id="lv-idtype" name="idType" value={idType} onChange={(e) => setIdType(e.target.value)} aria-invalid={err("idType")} className={field}>
          {ID_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        <label htmlFor="lv-id" className={`${label} mt-3`}>Numéro de la pièce</label>
        <input id="lv-id" name="idNumber" required defaultValue={v("idNumber")} autoComplete="off" autoCapitalize="characters" aria-invalid={err("idNumber")} className={field} />
        <div className={`mt-3 grid gap-3 ${needsVerso(idType) ? "grid-cols-2" : "grid-cols-1"}`}>
          <DocPicker id="lv-recto" label={needsVerso(idType) ? "Photo du recto" : "Photo de la page d'identité"} file={recto} onFile={setRecto} invalid={err("idRecto")} />
          {needsVerso(idType) && <DocPicker id="lv-verso" label="Photo du verso" file={verso} onFile={setVerso} invalid={err("idVerso")} />}
        </div>
        <p className="mt-2 text-xs text-navy/60">Photo nette, toute la pièce visible. Elle est vue uniquement par l&apos;équipe JAMAAL pour valider votre compte.</p>
      </fieldset>
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

/** Photo de la pièce : appareil photo ou galerie (PDF accepté), réduite avant l'envoi. */
function DocPicker({ id, label: text, file, onFile, invalid }: { id: string; label: string; file: File | null; onFile: (f: File | null) => void; invalid?: boolean }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  async function pick(f: File | undefined) {
    setError(null);
    if (!f) return;
    setBusy(true);
    try {
      const isImage = f.type.startsWith("image/") && !/heic|heif/.test(f.type);
      const blob = isImage ? await compressPhoto(f) : f;
      const out = blob instanceof File ? blob : new File([blob], `${id}.jpg`, { type: blob.type || "image/jpeg" });
      if (out.size > DOC_MAX_BYTES) {
        setError("Fichier trop lourd (3 Mo au plus).");
        onFile(null);
        return;
      }
      onFile(out);
      setPreview(out.type.startsWith("image/") && !/heic|heif/.test(out.type) ? URL.createObjectURL(out) : null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label htmlFor={id} className={`flex min-h-28 cursor-pointer flex-col items-center justify-center gap-1.5 overflow-hidden rounded-xl border-2 border-dashed p-2 text-center text-xs font-semibold ${file ? "border-emerald-600 bg-emerald-50 text-emerald-900" : invalid ? "border-rose-dark bg-rose/10 text-rose-dark" : "border-line bg-cream/50 text-navy"}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {preview ? <img src={preview} alt={text} className="h-20 w-full rounded-lg object-cover" /> : file ? <FileText size={26} /> : <Camera size={26} />}
        <span>{busy ? "Préparation…" : file ? `${text} ✓ (changer)` : text}</span>
      </label>
      <input id={id} type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => void pick(e.target.files?.[0])} />
      {error && <p role="alert" className="mt-1 text-xs text-rose-dark">{error}</p>}
    </div>
  );
}
