"use client";

import { startTransition, useActionState, useState, useTransition } from "react";
import { submitApplication, type ApplicationState } from "@/lib/actions/applications";
import { WHATSAPP_CONTACTS, whatsappLink } from "@/lib/contact";
import { fillProtocol, ID_TYPES, pieceLabel, type ProtocolDoc } from "@/lib/protocol";
import { ProtocolText } from "@/components/ProtocolText";
import { SignaturePad } from "@/components/SignaturePad";

/** Réduit une photo (1600 px au plus, JPEG) pour un envoi rapide, même en 3G. */
async function compressPhoto(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.82));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

const initial: ApplicationState = { ok: false };

const input =
  "mt-1.5 w-full rounded-xl border border-line bg-white px-4 py-3 text-sm outline-none transition focus:border-rose-dark focus:ring-4 focus:ring-rose/10";
const label = "text-xs font-semibold uppercase tracking-wide text-navy/60";

export function ApplicationForm({ sponsorCode = "", protocol }: { sponsorCode?: string; protocol: ProtocolDoc }) {
  const [state, action, pending] = useActionState(submitApplication, initial);
  const [preparing, startPrep] = useTransition();
  const [f, setF] = useState({ name: "", phone: "", address: "", idType: "CNI", idNumber: "", sponsorCode });
  const [signature, setSignature] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((v) => ({ ...v, [k]: e.target.value }));
  const filled = fillProtocol(protocol.text, { nom: f.name, piece: pieceLabel(f.idType, f.idNumber), adresse: f.address, telephone: f.phone, code_parrain: f.sponsorCode.toLowerCase() });

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLocalError(null);
    const form = e.currentTarget;
    if (!form.reportValidity()) return;
    if (!signature) {
      setLocalError("Signez le protocole dans le cadre prévu (au doigt ou à la souris).");
      return;
    }
    const fd = new FormData(form);
    startPrep(async () => {
      for (const k of ["idFront", "idBack"]) {
        const file = fd.get(k);
        if (file instanceof File && file.size) fd.set(k, await compressPhoto(file), `${k}.jpg`);
      }
      fd.set("signature", signature);
      fd.set("protocolVersion", String(protocol.version));
      startTransition(() => action(fd));
    });
  }
  const busy = pending || preparing;

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
    <form onSubmit={submit} noValidate={false} className="grid gap-5 sm:grid-cols-2">
      {/* Honeypot anti-robots : invisible pour les humains */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label>
          Site web
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="sm:col-span-2">
        <label htmlFor="name" className={label}>Nom complet *</label>
        <input id="name" name="name" required maxLength={100} autoComplete="name" value={f.name} onChange={set("name")} className={input} />
      </div>
      <div>
        <label htmlFor="email" className={label}>E-mail *</label>
        <input id="email" name="email" type="email" required maxLength={254} autoComplete="email" className={input} />
      </div>
      <div>
        <label htmlFor="phone" className={label}>Numéro WhatsApp *</label>
        <input id="phone" name="phone" type="tel" required maxLength={30} autoComplete="tel" placeholder="+221 77 000 00 00" value={f.phone} onChange={set("phone")} className={input} />
      </div>
      <div>
        <label htmlFor="city" className={label}>Ville *</label>
        <input id="city" name="city" required maxLength={80} autoComplete="address-level2" className={input} />
      </div>
      <div>
        <label htmlFor="country" className={label}>Pays</label>
        <input id="country" name="country" defaultValue="Sénégal" maxLength={60} className={input} />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="experience" className={label}>Expérience en vente (facultatif)</label>
        <textarea id="experience" name="experience" rows={2} maxLength={500} className={input} />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="motivation" className={label}>Pourquoi souhaitez-vous devenir consultant·e ? (facultatif)</label>
        <textarea id="motivation" name="motivation" rows={3} maxLength={1000} className={input} />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="sponsorCode" className={label}>Code de parrainage (obligatoire)</label>
        <input id="sponsorCode" name="sponsorCode" value={f.sponsorCode} onChange={set("sponsorCode")} required minLength={2} maxLength={48} placeholder="ex. aminata" className={input} />
        <p className="mt-1.5 text-xs text-navy/70">On ne rejoint JAMAAL que par un membre du réseau : demandez son code (ou utilisez son lien d&apos;invitation).</p>
      </div>

      <div className="sm:col-span-2">
        <label htmlFor="address" className={label}>Adresse complète *</label>
        <textarea id="address" name="address" required minLength={8} maxLength={300} rows={2} placeholder="Quartier, rue, n° de maison, ville" value={f.address} onChange={set("address")} className={input} />
      </div>

      <fieldset className="grid gap-4 rounded-2xl border border-line bg-cream/40 p-4 sm:col-span-2 sm:grid-cols-2">
        <legend className="px-1 text-sm font-semibold text-navy">Pièce d&apos;identité</legend>
        <p className="text-xs text-navy/70 sm:col-span-2">Obligatoire pour valider votre adhésion. Les photos sont conservées de façon privée et ne sont visibles que par l&apos;équipe JAMAAL.</p>
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
        <div>
          <label htmlFor="idFront" className={label}>Photo recto *</label>
          <input id="idFront" name="idFront" type="file" accept="image/*" capture="environment" required className={`${input} file:mr-3 file:rounded-full file:border-0 file:bg-navy file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white`} />
        </div>
        <div>
          <label htmlFor="idBack" className={label}>Photo verso *</label>
          <input id="idBack" name="idBack" type="file" accept="image/*" capture="environment" required className={`${input} file:mr-3 file:rounded-full file:border-0 file:bg-navy file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white`} />
        </div>
      </fieldset>

      <section aria-labelledby="protocol-title" className="space-y-3 sm:col-span-2">
        <div>
          <h2 id="protocol-title" className="font-serif-display text-xl text-navy">Protocole de partenariat</h2>
          <p className="text-xs text-navy/70">Version {protocol.version}. Lisez-le jusqu&apos;au bout : vos informations y sont reprises automatiquement. Vous recevrez l&apos;exemplaire signé en PDF.</p>
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
        <p role="alert" className="rounded-xl border border-rose-dark/20 bg-rose/10 px-4 py-3 text-sm text-rose-dark sm:col-span-2">
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
