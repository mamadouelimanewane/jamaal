"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { submitApplication, type ApplicationState } from "@/lib/actions/applications";
import { WHATSAPP_CONTACTS, whatsappLink } from "@/lib/contact";
import { fillProtocol, ID_TYPES, pieceLabel, type ProtocolDoc } from "@/lib/protocol";
import { ProtocolText } from "@/components/ProtocolText";
import { SignaturePad } from "@/components/SignaturePad";
import { compressPhoto } from "@/lib/compress-photo";
import { IdPhotoPicker } from "@/components/IdPhotoPicker";

const initial: ApplicationState = { ok: false };
/** Brouillon de la candidature (onglet en cours) : rien n'est perdu si la page se recharge après une erreur. */
const DRAFT_KEY = "jamaal_candidature_brouillon";
const DRAFT_FIELDS = ["name", "phone", "email", "city", "country", "address", "sponsorCode", "experience", "motivation", "idType", "idNumber"] as const;
const CHECKS = ["acceptProtocol", "acceptTerms"] as const;

const input =
  "mt-1.5 w-full rounded-xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-rose-dark focus:ring-4 focus:ring-rose/10";
const label = "text-xs font-semibold uppercase tracking-wide text-navy/60";
const step = "flex items-center gap-2.5 font-serif-display text-xl text-navy sm:col-span-2";
const stepNum = "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy font-sans text-sm font-semibold text-white";

export function ApplicationForm({ sponsorCode = "", sponsorName = null, protocol }: { sponsorCode?: string; sponsorName?: string | null; protocol: ProtocolDoc }) {
  const [state, setState] = useState<ApplicationState>(initial);
  const [pending, startPrep] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const [restored, setRestored] = useState(false);
  const [f, setF] = useState({ name: "", phone: "", address: "", idType: "CNI", idNumber: "", sponsorCode });
  const [signature, setSignature] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<{ idFront: File | null; idBack: File | null }>({ idFront: null, idBack: null });
  const [triedSubmit, setTriedSubmit] = useState(false);
  // Code reçu par lien d'invitation : fixe, le candidat ne peut pas le changer.
  const locked = sponsorCode !== "";
  // Reprise du brouillon (après un rechargement de la page) : champs texte et cases cochées.
  useEffect(() => {
    let draft: Record<string, string | boolean> | null = null;
    try {
      draft = JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? "null");
    } catch {
      draft = null;
    }
    const form = formRef.current;
    if (!draft || !form) return;
    queueMicrotask(() => {
      setF((v) => ({
        ...v,
        ...Object.fromEntries((["name", "phone", "address", "idType", "idNumber"] as const).filter((k) => typeof draft![k] === "string").map((k) => [k, draft![k] as string])),
        ...(locked || typeof draft!.sponsorCode !== "string" ? {} : { sponsorCode: draft!.sponsorCode as string }),
      }));
      for (const k of ["email", "city", "country", "experience", "motivation"]) {
        const el = form.elements.namedItem(k) as HTMLInputElement | HTMLTextAreaElement | null;
        if (el && typeof draft![k] === "string" && draft![k]) el.value = draft![k] as string;
      }
      for (const k of CHECKS) {
        const el = form.elements.namedItem(k) as HTMLInputElement | null;
        if (el && draft![k] === true) el.checked = true;
      }
      if (Object.values(draft!).some((v) => v)) setRestored(true);
    });
  }, [locked]);

  function saveDraft() {
    const form = formRef.current;
    if (!form) return;
    const fd = new FormData(form);
    const draft: Record<string, string | boolean> = {};
    for (const k of DRAFT_FIELDS) draft[k] = String(fd.get(k) ?? "");
    for (const k of CHECKS) draft[k] = fd.get(k) === "on";
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // stockage indisponible : le formulaire reste rempli tant que la page n'est pas rechargée
    }
  }

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((v) => ({ ...v, [k]: e.target.value }));
  const filled = fillProtocol(protocol.text, { nom: f.name, piece: pieceLabel(f.idType, f.idNumber), adresse: f.address, telephone: f.phone, code_parrain: f.sponsorCode.toLowerCase() });

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLocalError(null);
    const form = e.currentTarget;
    setTriedSubmit(true);
    if (!form.reportValidity()) return;
    if (!photos.idFront || !photos.idBack) {
      setLocalError("Ajoutez la photo du recto et du verso de votre pièce d'identité (appareil photo ou galerie).");
      document.getElementById("idFront")?.closest("fieldset")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (!signature) {
      setLocalError("Signez le protocole dans le cadre prévu (au doigt ou à la souris).");
      return;
    }
    saveDraft();
    const fd = new FormData(form);
    startPrep(async () => {
      try {
        for (const k of ["idFront", "idBack"] as const) {
          const file = photos[k];
          if (file) fd.set(k, await compressPhoto(file), `${k}.jpg`);
        }
        fd.set("signature", signature);
        fd.set("protocolVersion", String(protocol.version));
        // Appel direct : une erreur (réseau coupé, site mis à jour, envoi trop lourd) revient ici au lieu
        // d'afficher une page d'erreur qui ferait perdre le formulaire.
        const r = await submitApplication(initial, fd);
        if (r.ok) {
          try {
            sessionStorage.removeItem(DRAFT_KEY);
          } catch {
            // rien à nettoyer
          }
        }
        setState(r);
        if (!r.ok) requestAnimationFrame(() => document.getElementById("candidature-erreur")?.scrollIntoView({ behavior: "smooth", block: "center" }));
      } catch {
        setState({ ok: false, error: "L'envoi n'a pas abouti (connexion coupée ou site mis à jour). Vos informations sont gardées : vérifiez votre connexion puis appuyez de nouveau sur « Signer et envoyer ». Si le problème continue, rechargez la page : les champs se rempliront tout seuls (photos et signature à refaire)." });
        requestAnimationFrame(() => document.getElementById("candidature-erreur")?.scrollIntoView({ behavior: "smooth", block: "center" }));
      }
    });
  }
  const busy = pending;

  if (state.ok) {
    return (
      <div role="status" className="rounded-2xl border border-line bg-white p-8 text-center">
        <p className="font-serif-display text-2xl text-navy">Merci pour votre candidature !</p>
        <p className="mt-3 text-sm leading-relaxed text-navy/70">
          Notre équipe étudie votre demande et vous contacte sur WhatsApp ou par e-mail très
          prochainement. Si elle est acceptée, vous recevrez un lien pour activer votre espace consultant.
        </p>
        {state.applicant && (
          <div className="mt-6 border-t border-line pt-5">
            <p className="text-sm font-semibold text-navy">Gagnez du temps : prévenez l&apos;équipe sur WhatsApp</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-center">
              {WHATSAPP_CONTACTS.map((c) => (
                <a
                  key={c.number}
                  href={whatsappLink(
                    c.number,
                    `Bonjour JAMAAL, je viens de postuler pour devenir consultant·e. Nom : ${state.applicant!.name} — Ville : ${state.applicant!.city} — Téléphone : ${state.applicant!.phone}.`
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full bg-[#25D366] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                >
                  WhatsApp {c.display}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={submit} onInput={saveDraft} onChange={saveDraft} noValidate={false} className="grid gap-5 sm:grid-cols-2">
      {restored && (
        <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 sm:col-span-2">
          Nous avons repris les informations que vous aviez saisies. Ajoutez de nouveau les photos de votre pièce et votre signature, puis envoyez.
        </p>
      )}
      {/* Honeypot anti-robots : invisible pour les humains */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label>
          Site web
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <h2 className={step}><span className={stepNum}>1</span> Vos informations</h2>
      <div className="sm:col-span-2">
        <label htmlFor="name" className={label}>Nom complet *</label>
        <input id="name" name="name" required maxLength={100} autoComplete="name" placeholder="Prénom et nom" value={f.name} onChange={set("name")} className={input} />
      </div>
      <div>
        <label htmlFor="phone" className={label}>Numéro WhatsApp *</label>
        <input id="phone" name="phone" type="tel" inputMode="tel" required maxLength={30} autoComplete="tel" placeholder="77 000 00 00" value={f.phone} onChange={set("phone")} className={input} />
      </div>
      <div>
        <label htmlFor="email" className={label}>E-mail *</label>
        <input id="email" name="email" type="email" required maxLength={254} autoComplete="email" placeholder="nom@exemple.com" className={input} />
      </div>
      <div>
        <label htmlFor="city" className={label}>Ville *</label>
        <input id="city" name="city" required maxLength={80} autoComplete="address-level2" placeholder="Dakar" className={input} />
      </div>
      {locked ? (
        <input type="hidden" name="country" value="Sénégal" />
      ) : (
        <div>
          <label htmlFor="country" className={label}>Pays</label>
          <input id="country" name="country" defaultValue="Sénégal" maxLength={60} className={input} />
        </div>
      )}
      <div className={locked ? "" : "sm:col-span-2"}>
        <label htmlFor="address" className={label}>Adresse *</label>
        <input id="address" name="address" required minLength={8} maxLength={300} autoComplete="street-address" placeholder="Quartier, rue, n° de maison" value={f.address} onChange={set("address")} className={input} />
      </div>

      {locked ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 sm:col-span-2">
          <p className="text-sm text-emerald-900">Votre parrain : <strong>{sponsorName ?? f.sponsorCode}</strong> <span className="text-emerald-800/80">· code {f.sponsorCode}</span></p>
          <input type="hidden" name="sponsorCode" value={f.sponsorCode} />
        </div>
      ) : (
        <>
          <div className="sm:col-span-2">
            <label htmlFor="sponsorCode" className={label}>Code de parrainage *</label>
            <input id="sponsorCode" name="sponsorCode" value={f.sponsorCode} onChange={set("sponsorCode")} required minLength={2} maxLength={48} placeholder="ex. aminata" className={input} />
            <p className="mt-1.5 text-xs text-navy/70">
              Demandez-le à la personne qui vous a invité·e. Pas de parrain ?{" "}
              <a href={whatsappLink(WHATSAPP_CONTACTS[0].number, "Bonjour JAMAAL, je souhaite devenir consultant·e mais je n'ai pas de code de parrainage.")} target="_blank" rel="noopener noreferrer" className="font-semibold text-rose-dark underline">Demandez un code à JAMAAL</a>.
            </p>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="experience" className={label}>Expérience en vente (facultatif)</label>
            <textarea id="experience" name="experience" rows={2} maxLength={500} className={input} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="motivation" className={label}>Pourquoi souhaitez-vous devenir consultant·e ? (facultatif)</label>
            <textarea id="motivation" name="motivation" rows={2} maxLength={1000} className={input} />
          </div>
        </>
      )}

      <fieldset className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
        <legend className={`${step} mb-4`}><span className={stepNum}>2</span> Pièce d&apos;identité</legend>
        <div>
          <label htmlFor="idType" className={label}>Type de pièce *</label>
          <select id="idType" name="idType" required value={f.idType} onChange={set("idType")} className={input}>
            {Object.entries(ID_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="idNumber" className={label}>Numéro de la pièce *</label>
          <input id="idNumber" name="idNumber" required pattern="[A-Za-z0-9 \-]{5,30}" maxLength={30} value={f.idNumber} onChange={set("idNumber")} className={input} />
        </div>
        <IdPhotoPicker id="idFront" label="Photo recto *" file={photos.idFront} onChange={(file) => setPhotos((p) => ({ ...p, idFront: file }))} invalid={triedSubmit} />
        <IdPhotoPicker id="idBack" label="Photo verso *" file={photos.idBack} onChange={(file) => setPhotos((p) => ({ ...p, idBack: file }))} invalid={triedSubmit} />
        <p className="text-xs text-navy/60 sm:col-span-2">Visibles uniquement par l&apos;équipe JAMAAL.</p>
      </fieldset>

      <section aria-labelledby="protocol-title" className="space-y-3 sm:col-span-2">
        <div>
          <h2 id="protocol-title" className={step}><span className={stepNum}>3</span> Contrat et signature</h2>
          <p className="mt-1 text-xs text-navy/70">Protocole de partenariat, version {protocol.version}, rempli avec vos informations. Vous recevrez l&apos;exemplaire signé en PDF.</p>
        </div>
        <div tabIndex={0} aria-label="Texte du protocole de partenariat" className="max-h-96 overflow-y-auto rounded-2xl border border-line bg-white p-5">
          <ProtocolText text={filled} />
        </div>
        <label className="flex items-start gap-3 text-sm font-medium text-navy">
          <input type="checkbox" name="acceptProtocol" required className="mt-1 h-4 w-4 accent-[#1d2f4f]" />
          Lu et approuvé : j&apos;accepte le protocole de partenariat JAMAAL et je le signe ci-dessous.
        </label>
        <SignaturePad onChange={(v) => { setSignature(v); if (v) setLocalError(null); }} />
      </section>

      <label className="flex items-start gap-3 text-sm text-navy/75 sm:col-span-2">
        <input type="checkbox" name="acceptTerms" required className="mt-1 h-4 w-4 accent-[#1d2f4f]" />
        J&apos;accepte d&apos;être recontacté·e par l&apos;équipe JAMAAL au sujet de ma candidature.
      </label>

      {(localError ?? state.error) && (
        <p id="candidature-erreur" role="alert" className="rounded-xl border border-rose-dark/20 bg-rose/10 px-4 py-3 text-sm text-rose-dark sm:col-span-2">
          {localError ?? state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="rounded-full bg-navy px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-navy-light disabled:opacity-60 sm:col-span-2"
      >
        {busy ? "Envoi…" : "Signer et envoyer ma candidature"}
      </button>
    </form>
  );
}
