"use client";

import { startTransition, useActionState, useState } from "react";
import { ArrowLeft, ArrowRight, Camera, Check, FileText, Loader2 } from "lucide-react";
import { compressPhoto } from "@/lib/compress-photo";
import { registerLivreur, type SignupState } from "@/lib/actions/livreur-signup";
import { DOC_MAX_BYTES, needsVerso, secretError } from "@/lib/livreur-signup";
import { ListenButton } from "./Listen";

/** Couleurs des étapes (texte blanc lisible sur chacune, contraste AA). */
const STEPS = [
  { key: "nom", emoji: "👤", color: "#6D4AFF", title: "Votre nom", say: "Écrivez votre prénom et votre nom, comme sur votre carte d'identité." },
  { key: "tel", emoji: "📱", color: "#15803D", title: "Votre numéro WhatsApp", say: "Écrivez votre numéro WhatsApp. C'est avec ce numéro que vous vous connecterez." },
  { key: "code", emoji: "🔒", color: "#1d2f4f", title: "Votre code secret", say: "Choisissez un code secret de six chiffres. Tapez-le deux fois. Ne le donnez à personne." },
  { key: "zone", emoji: "🛵", color: "#C2410C", title: "Où et comment ?", say: "Écrivez vos quartiers de livraison, puis touchez votre moyen de transport." },
  { key: "piece", emoji: "🪪", color: "#2563EB", title: "Votre pièce d'identité", say: "Touchez votre pièce : carte d'identité, passeport ou permis. Écrivez son numéro, puis prenez-la en photo." },
  { key: "argent", emoji: "💰", color: "#0F766E", title: "Votre argent", say: "Choisissez où recevoir votre argent : Wave ou Orange Money." },
  { key: "charte", emoji: "🤝", color: "#BE185D", title: "Les règles du livreur", say: "Lisez les règles du livreur JAMAAL. Cochez la case, puis touchez Envoyer." },
] as const;

const VEHICLE_TILES = [
  { id: "MOTO", emoji: "🏍️", label: "Moto" },
  { id: "SCOOTER", emoji: "🛵", label: "Scooter" },
  { id: "VELO", emoji: "🚲", label: "Vélo" },
  { id: "VOITURE", emoji: "🚗", label: "Voiture" },
  { id: "PIED", emoji: "🚶", label: "À pied" },
];
const ID_TILES = [
  { id: "CNI", emoji: "🪪", label: "Carte d'identité" },
  { id: "PASSEPORT", emoji: "🛂", label: "Passeport" },
  { id: "PERMIS", emoji: "🚘", label: "Permis" },
];
const RULES = [
  { emoji: "📦", text: "Je livre le colis en bon état, à l'heure." },
  { emoji: "📞", text: "J'appelle le client avant d'arriver." },
  { emoji: "🔢", text: "Je demande le code du client pour finir la livraison." },
  { emoji: "💵", text: "Je rends à JAMAAL l'argent encaissé, le jour même." },
  { emoji: "🙂", text: "Je suis poli et je respecte le code de la route." },
];
/** Erreur du serveur → étape à rouvrir. */
const FIELD_STEP: Record<string, number> = { name: 0, phone: 1, password: 2, confirm: 2, zone: 3, vehicle: 3, idType: 4, idNumber: 4, idRecto: 4, idVerso: 4, walletNumber: 5, walletProvider: 5, charte: 6 };

const big = "w-full rounded-2xl border-2 border-line bg-white px-4 py-4 text-xl font-semibold text-navy outline-none placeholder:font-normal placeholder:text-navy/35 focus:border-navy focus:ring-4 focus:ring-navy/10";

export function prettyPhone(p: string) {
  const d = p.replace(/\D/g, "");
  const local = d.startsWith("221") && d.length === 12 ? d.slice(3) : d;
  return local.length === 9 ? `${local.slice(0, 2)} ${local.slice(2, 5)} ${local.slice(5, 7)} ${local.slice(7)}` : p;
}

/**
 * Inscription du livreur en 7 petits écrans : une seule question à la fois, de grandes images, des couleurs,
 * un bouton « Écouter » qui lit la consigne. Le numéro WhatsApp est l'identifiant ; le code secret a 6 chiffres.
 */
export function SignupWizard({ installed, onLogin }: { installed: boolean; onLogin: () => void }) {
  const [state, action, pending] = useActionState<SignupState, FormData>(registerLivreur, null);
  const [step, setStep] = useState(0);
  const [seenError, setSeenError] = useState<number | undefined>(undefined);
  const [v, setV] = useState({ name: "", phone: "", password: "", confirm: "", zone: "", vehicle: "MOTO", idType: "CNI", idNumber: "", walletProvider: "WAVE", walletNumber: "", charte: false });
  const [recto, setRecto] = useState<File | null>(null);
  const [verso, setVerso] = useState<File | null>(null);
  const [local, setLocal] = useState<string | null>(null);
  const [plainPwd, setPlainPwd] = useState(false);
  const set = (k: keyof typeof v, val: string | boolean) => setV((o) => ({ ...o, [k]: val }));

  // Erreur renvoyée par le serveur : on rouvre l'écran concerné (une fois par réponse).
  const serverError = state && !state.ok ? state : null;
  if (serverError && seenError !== serverError.n) {
    setSeenError(serverError.n);
    setStep(FIELD_STEP[serverError.field ?? ""] ?? 0);
    setLocal(serverError.error ?? "Erreur");
  }

  if (state?.ok) return <Done name={state.name} phone={state.phone} installed={installed} onLogin={onLogin} />;

  const s = STEPS[step];
  const digits = (x: string) => x.replace(/\D/g, "");
  function check(i: number): string | null {
    if (i === 0 && (v.name.trim().length < 3 || !/\s/.test(v.name.trim()))) return "Écrivez votre prénom ET votre nom.";
    if (i === 1 && digits(v.phone).length < 9) return "Le numéro doit avoir 9 chiffres, par exemple 77 123 45 67.";
    if (i === 2) {
      const e = secretError(v.password);
      if (e) return e;
      if (v.password !== v.confirm) return "Les deux codes ne sont pas pareils. Recommencez.";
    }
    if (i === 3 && v.zone.trim().length < 2) return "Écrivez au moins un quartier.";
    if (i === 4) {
      if (v.idNumber.replace(/[^0-9a-z]/gi, "").length < 5) return "Écrivez le numéro de votre pièce.";
      if (!recto) return "Prenez la photo de votre pièce.";
      if (needsVerso(v.idType) && !verso) return "Prenez aussi la photo de l'arrière (verso).";
    }
    if (i === 5 && v.walletNumber && digits(v.walletNumber).length < 9) return "Le numéro Wave ou Orange Money doit avoir 9 chiffres.";
    if (i === 6 && !v.charte) return "Cochez la case pour accepter les règles.";
    return null;
  }
  function next() {
    const e = check(step);
    setLocal(e);
    if (e) return;
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const fd = new FormData();
    fd.set("name", v.name);
    fd.set("phone", v.phone);
    fd.set("password", v.password);
    fd.set("confirm", v.confirm);
    fd.set("zone", v.zone);
    fd.set("vehicle", v.vehicle);
    fd.set("idType", v.idType);
    fd.set("idNumber", v.idNumber);
    fd.set("walletProvider", v.walletProvider);
    fd.set("walletNumber", v.walletNumber);
    if (v.charte) fd.set("charte", "on");
    if (recto) fd.set("idRecto", recto);
    if (verso && needsVerso(v.idType)) fd.set("idVerso", verso);
    startTransition(() => action(fd));
  }
  const back = () => {
    setLocal(null);
    setStep(Math.max(0, step - 1));
  };

  return (
    <div className="mt-4 overflow-hidden rounded-3xl border-2 text-left" style={{ borderColor: s.color }}>
      <div className="px-4 pb-4 pt-3 text-white" style={{ background: s.color }}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-bold opacity-90">Étape {step + 1} sur {STEPS.length}</span>
          <ListenButton text={`${s.title}. ${s.say}`} tone="dark" />
        </div>
        <div className="mt-2 flex items-center gap-3">
          <span className="text-5xl leading-none" aria-hidden="true">{s.emoji}</span>
          <h2 className="text-2xl font-extrabold leading-tight">{s.title}</h2>
        </div>
        <div className="mt-3 flex gap-1.5" aria-hidden="true">
          {STEPS.map((x, i) => <span key={x.key} className={`h-2 flex-1 rounded-full ${i <= step ? "bg-white" : "bg-white/30"}`} />)}
        </div>
      </div>

      <div className="space-y-4 bg-white p-4">
        <p className="text-base leading-6 text-navy/80">{s.say}</p>

        {step === 0 && <input aria-label="Prénom et nom" value={v.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" placeholder="Ex. Moussa Diop" className={big} autoFocus />}

        {step === 1 && (
          <input aria-label="Numéro WhatsApp" value={v.phone} onChange={(e) => set("phone", e.target.value)} type="tel" inputMode="tel" autoComplete="tel" placeholder="77 123 45 67" className={`${big} text-center text-3xl tracking-wider`} autoFocus />
        )}

        {step === 2 && (
          <div className="space-y-3">
            <label className="block text-sm font-bold text-navy">Mon code secret
              <input aria-label="Code secret" value={v.password} onChange={(e) => set("password", plainPwd ? e.target.value : e.target.value.replace(/\D/g, "").slice(0, 6))} type="password" inputMode={plainPwd ? "text" : "numeric"} autoComplete="new-password" placeholder={plainPwd ? "Mot de passe" : "● ● ● ● ● ●"} className={`${big} mt-1 text-center text-3xl tracking-[0.5em]`} />
            </label>
            <label className="block text-sm font-bold text-navy">Je tape le même code encore une fois
              <input aria-label="Confirmer le code secret" value={v.confirm} onChange={(e) => set("confirm", plainPwd ? e.target.value : e.target.value.replace(/\D/g, "").slice(0, 6))} type="password" inputMode={plainPwd ? "text" : "numeric"} autoComplete="new-password" placeholder={plainPwd ? "Mot de passe" : "● ● ● ● ● ●"} className={`${big} mt-1 text-center text-3xl tracking-[0.5em]`} />
            </label>
            {v.confirm.length > 0 && <p className={`text-center text-base font-bold ${v.password === v.confirm ? "text-[#15803D]" : "text-[#B45309]"}`}>{v.password === v.confirm ? "✅ Les deux codes sont pareils" : "✋ Les codes ne sont pas encore pareils"}</p>}
            <button type="button" onClick={() => { setPlainPwd(!plainPwd); set("password", ""); set("confirm", ""); }} className="text-sm font-semibold text-navy/70 underline">
              {plainPwd ? "Je préfère un code de 6 chiffres" : "Je préfère un mot de passe avec des lettres"}
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <label className="block text-sm font-bold text-navy">📍 Mes quartiers
              <input aria-label="Quartiers de livraison" value={v.zone} onChange={(e) => set("zone", e.target.value)} placeholder="Ex. Médina, Fann, Plateau" className={`${big} mt-1`} />
            </label>
            <fieldset>
              <legend className="text-sm font-bold text-navy">Je me déplace en…</legend>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {VEHICLE_TILES.map((t) => (
                  <Tile key={t.id} on={v.vehicle === t.id} color="#C2410C" emoji={t.emoji} label={t.label} onClick={() => set("vehicle", t.id)} />
                ))}
              </div>
            </fieldset>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Type de pièce">
              {ID_TILES.map((t) => (
                <Tile key={t.id} on={v.idType === t.id} color="#2563EB" emoji={t.emoji} label={t.label} onClick={() => set("idType", t.id)} />
              ))}
            </div>
            <label className="block text-sm font-bold text-navy">Numéro écrit sur la pièce
              <input aria-label="Numéro de la pièce" value={v.idNumber} onChange={(e) => set("idNumber", e.target.value.toUpperCase())} autoCapitalize="characters" autoComplete="off" placeholder="Ex. 1 751 1990 01234" className={`${big} mt-1`} />
            </label>
            <div className={`grid gap-3 ${needsVerso(v.idType) ? "grid-cols-2" : "grid-cols-1"}`}>
              <PhotoTile id="lv-recto" label={needsVerso(v.idType) ? "Photo du devant" : "Photo de la page avec ma photo"} file={recto} onFile={setRecto} />
              {needsVerso(v.idType) && <PhotoTile id="lv-verso" label="Photo de l'arrière" file={verso} onFile={setVerso} />}
            </div>
            <p className="text-sm text-navy/65">🔐 Seule l&apos;équipe JAMAAL voit ces photos.</p>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Recevoir mon argent sur">
              <button type="button" role="radio" aria-checked={v.walletProvider === "WAVE"} onClick={() => set("walletProvider", "WAVE")} className={`rounded-2xl p-4 text-center text-xl font-extrabold text-white ring-offset-2 ${v.walletProvider === "WAVE" ? "ring-4 ring-[#1d4ed8]" : "opacity-60"}`} style={{ background: "#1d4ed8" }}>
                <span className="block text-4xl" aria-hidden="true">💙</span>Wave
              </button>
              <button type="button" role="radio" aria-checked={v.walletProvider === "ORANGE_MONEY"} onClick={() => set("walletProvider", "ORANGE_MONEY")} className={`rounded-2xl p-4 text-center text-xl font-extrabold text-white ring-offset-2 ${v.walletProvider === "ORANGE_MONEY" ? "ring-4 ring-[#C2410C]" : "opacity-60"}`} style={{ background: "#C2410C" }}>
                <span className="block text-4xl" aria-hidden="true">🧡</span>Orange Money
              </button>
            </div>
            <label className="block text-sm font-bold text-navy">Numéro {v.walletProvider === "WAVE" ? "Wave" : "Orange Money"}
              <input aria-label="Numéro de paiement" value={v.walletNumber} onChange={(e) => set("walletNumber", e.target.value)} type="tel" inputMode="tel" placeholder={v.phone || "77 123 45 67"} className={`${big} mt-1 text-center text-2xl tracking-wider`} />
            </label>
            <p className="text-sm text-navy/65">Laissez vide : on utilise votre numéro WhatsApp.</p>
          </div>
        )}

        {step === 6 && (
          <div className="space-y-3">
            <ul className="space-y-2">
              {RULES.map((r) => (
                <li key={r.text} className="flex items-center gap-3 rounded-2xl bg-[#FDF2F8] p-3 text-base font-semibold text-navy">
                  <span className="text-3xl" aria-hidden="true">{r.emoji}</span>{r.text}
                </li>
              ))}
            </ul>
            <ListenButton text={`Les règles du livreur. ${RULES.map((r) => r.text).join(" ")}`} label="Écouter les règles" />
            <button type="button" role="checkbox" aria-checked={v.charte} onClick={() => set("charte", !v.charte)} className={`flex w-full items-center gap-3 rounded-2xl border-2 p-4 text-left text-lg font-bold ${v.charte ? "border-[#15803D] bg-[#F0FDF4] text-[#14532D]" : "border-line text-navy"}`}>
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 ${v.charte ? "border-[#15803D] bg-[#15803D] text-white" : "border-navy/40"}`}>{v.charte && <Check size={22} strokeWidth={3} />}</span>
              J&apos;accepte les règles du livreur JAMAAL
            </button>
          </div>
        )}

        {local && <p role="alert" className="rounded-2xl bg-[#FEF3C7] px-4 py-3 text-base font-bold text-[#78350F]">✋ {local}</p>}

        <div className="flex gap-3 pt-1">
          {step > 0 && (
            <button type="button" onClick={back} aria-label="Retour" className="flex min-h-16 w-20 shrink-0 items-center justify-center rounded-2xl bg-cream text-navy">
              <ArrowLeft size={28} />
            </button>
          )}
          <button type="button" onClick={next} disabled={pending} className="flex min-h-16 flex-1 items-center justify-center gap-2 rounded-2xl text-xl font-extrabold text-white shadow-lg disabled:opacity-60" style={{ background: step === STEPS.length - 1 ? "#15803D" : s.color }}>
            {pending ? <><Loader2 className="animate-spin" size={24} /> Envoi…</> : step === STEPS.length - 1 ? <>Envoyer ✅</> : <>Suivant <ArrowRight size={26} /></>}
          </button>
        </div>
      </div>
    </div>
  );
}

function Tile({ on, color, emoji, label, onClick }: { on: boolean; color: string; emoji: string; label: string; onClick: () => void }) {
  return (
    <button type="button" role="radio" aria-checked={on} onClick={onClick} className={`flex min-h-24 flex-col items-center justify-center gap-1 rounded-2xl border-2 p-2 text-center text-sm font-bold ${on ? "text-white shadow-md" : "border-line bg-white text-navy"}`} style={on ? { background: color, borderColor: color } : undefined}>
      <span className="text-4xl leading-none" aria-hidden="true">{emoji}</span>
      {label}
    </button>
  );
}

/** Grande tuile photo : appareil photo ou galerie (PDF accepté), photo réduite avant l'envoi. */
function PhotoTile({ id, label, file, onFile }: { id: string; label: string; file: File | null; onFile: (f: File | null) => void }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function pick(f: File | undefined) {
    setError(null);
    if (!f) return;
    setBusy(true);
    try {
      const isImage = f.type.startsWith("image/") && !/heic|heif/.test(f.type);
      const blob = isImage ? await compressPhoto(f) : f;
      const out = blob instanceof File ? blob : new File([blob], `${id}.jpg`, { type: blob.type || "image/jpeg" });
      if (out.size > DOC_MAX_BYTES) {
        setError("Photo trop lourde. Reprenez-la.");
        onFile(null);
        return;
      }
      if (preview) URL.revokeObjectURL(preview);
      onFile(out);
      setPreview(isImage ? URL.createObjectURL(out) : null);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <label htmlFor={id} className={`flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border-2 border-dashed p-2 text-center text-base font-bold ${file ? "border-[#15803D] bg-[#F0FDF4] text-[#14532D]" : "border-[#2563EB] bg-[#EFF6FF] text-[#1E3A8A]"}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {preview ? <img src={preview} alt={label} className="h-24 w-full rounded-xl object-cover" /> : file ? <FileText size={40} /> : busy ? <Loader2 className="animate-spin" size={40} /> : <Camera size={44} />}
        <span>{file ? `✅ ${label}` : `📸 ${label}`}</span>
        {file && <span className="text-xs font-semibold underline">Changer</span>}
      </label>
      <input id={id} type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => void pick(e.target.files?.[0])} />
      {error && <p role="alert" className="mt-1 text-sm font-bold text-[#B45309]">{error}</p>}
    </div>
  );
}

function Done({ name, phone, installed, onLogin }: { name?: string; phone?: string; installed: boolean; onLogin: () => void }) {
  const say = `Merci ${name ?? ""}. Votre inscription est envoyée. Votre identifiant est votre numéro WhatsApp. L'équipe JAMAAL va vérifier votre pièce, puis vous recevrez un message WhatsApp.`;
  return (
    <div className="mt-4 space-y-4 text-left">
      <div className="rounded-3xl bg-[#15803D] p-5 text-center text-white">
        <span className="text-6xl" aria-hidden="true">🎉</span>
        <p className="mt-2 text-2xl font-extrabold">Merci{name ? ` ${name}` : ""} !</p>
        <p className="mt-1 text-base font-semibold">Votre inscription est envoyée.</p>
        {phone && (
          <p className="mx-auto mt-4 w-fit rounded-2xl bg-white px-5 py-3 text-[#14532D]">
            <span className="block text-sm font-bold">Mon identifiant</span>
            <span className="text-3xl font-extrabold tracking-wide">{prettyPhone(phone)}</span>
          </p>
        )}
        <div className="mt-4"><ListenButton text={say} tone="dark" /></div>
      </div>
      <ol className="grid grid-cols-3 gap-2 text-center text-sm font-bold text-navy">
        <li className="rounded-2xl bg-[#DCFCE7] p-3"><span className="block text-3xl">✅</span>Inscrit</li>
        <li className="rounded-2xl bg-[#FEF3C7] p-3"><span className="block text-3xl">⏳</span>JAMAAL vérifie</li>
        <li className="rounded-2xl bg-[#DBEAFE] p-3"><span className="block text-3xl">💬</span>Message WhatsApp</li>
      </ol>
      {!installed ? (
        <p className="rounded-3xl border-2 border-[#F59E0B] bg-[#FFFBEB] p-4 text-lg font-extrabold text-[#78350F]">📲 Pas encore fait ? Mettez l&apos;icône JAMAAL Livreur sur votre téléphone (étape 1, en haut de la page).</p>
      ) : (
        <button type="button" onClick={onLogin} className="min-h-16 w-full rounded-2xl bg-navy text-xl font-extrabold text-white">Me connecter</button>
      )}
    </div>
  );
}
