"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, HardDriveUpload, ImagePlus, Link2, Loader2, Star, Trash2 } from "lucide-react";
import { compressImage } from "@/lib/image-compress";
import { MAX_PRODUCT_PHOTOS, isAcceptablePhotoUrl } from "@/lib/product-photos";

type Pending = { key: string; label: string };

/** Champ invisible et invalide tant qu'une photo s'envoie : le navigateur bloque l'envoi du formulaire avec ce message. */
function UploadGuard() {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.setCustomValidity("Attendez la fin de l'envoi des photos."), []);
  return <input ref={ref} type="text" defaultValue="" className="pointer-events-none absolute h-px w-px opacity-0" aria-hidden="true" tabIndex={-1} />;
}

async function postPhoto(body: FormData | { driveUrl: string }): Promise<string> {
  const res = await fetch("/api/admin/photo-produit", body instanceof FormData ? { method: "POST", body } : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !data.url) throw new Error(data.error ?? "Envoi impossible, réessayez.");
  return data.url;
}

/**
 * Photos d'une fiche produit : depuis l'ordinateur ou le téléphone (plusieurs à la fois, réduites
 * avant envoi), depuis un lien Google Drive, ou par adresse d'image. La première est la photo
 * principale ; l'ordre se change avec les flèches. Le formulaire reçoit la liste dans « photos ».
 */
export function ProductPhotosEditor({ initial }: { initial: string[] }) {
  const [photos, setPhotos] = useState<string[]>(initial);
  const [pending, setPending] = useState<Pending[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [drive, setDrive] = useState("");
  const [url, setUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const room = MAX_PRODUCT_PHOTOS - photos.length - pending.length;
  const add = (u: string) => setPhotos((ps) => (ps.includes(u) ? ps : [...ps, u]));
  const track = async (label: string, job: () => Promise<string>) => {
    const key = `${Date.now()}-${Math.random()}`;
    setPending((p) => [...p, { key, label }]);
    try {
      add(await job());
    } catch (e) {
      setErrors((es) => [...es, `${label} : ${e instanceof Error ? e.message : "échec"}`]);
    } finally {
      setPending((p) => p.filter((x) => x.key !== key));
    }
  };

  async function onFiles(files: FileList | null) {
    setErrors([]);
    const list = [...(files ?? [])].slice(0, Math.max(0, room));
    if (files && files.length > list.length) setErrors([`${MAX_PRODUCT_PHOTOS} photos au plus par fiche : les suivantes sont ignorées.`]);
    // Une à la fois : l'ordre choisi est conservé et le téléphone n'est pas saturé.
    for (const f of list) {
      await track(f.name, async () => {
        const small = await compressImage(f);
        const fd = new FormData();
        fd.append("file", small);
        return postPhoto(fd);
      });
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onDrive() {
    const links = drive.split(/\s+/).filter(Boolean).slice(0, Math.max(0, room));
    if (!links.length) return;
    setErrors([]);
    setDrive("");
    for (const l of links) await track("Lien Drive", () => postPhoto({ driveUrl: l }));
  }

  function onUrl() {
    const u = url.trim();
    if (!u) return;
    if (!isAcceptablePhotoUrl(u)) {
      setErrors(["Adresse refusée : collez une adresse https://… ou un chemin /produits/…"]);
      return;
    }
    setErrors([]);
    add(u);
    setUrl("");
  }

  const move = (i: number, d: -1 | 1) =>
    setPhotos((ps) => {
      const j = i + d;
      if (j < 0 || j >= ps.length) return ps;
      const next = [...ps];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const makeMain = (i: number) => setPhotos((ps) => [ps[i], ...ps.filter((_, k) => k !== i)]);
  const remove = (i: number) => setPhotos((ps) => ps.filter((_, k) => k !== i));

  const busy = pending.length > 0;

  return (
    <div className="relative rounded-xl border border-line bg-white p-4">
      <input type="hidden" name="photos" value={JSON.stringify(photos)} />
      {/* Empêche l'envoi du formulaire tant qu'une photo est en cours d'envoi. */}
      {busy && <UploadGuard />}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-navy/85">
          Photos ({photos.length}/{MAX_PRODUCT_PHOTOS}) — la première est la photo principale
        </p>
        {busy && (
          <span className="flex items-center gap-1.5 text-xs text-navy/70">
            <Loader2 size={14} className="animate-spin" /> Envoi de {pending.length} photo(s)…
          </span>
        )}
      </div>

      {photos.length > 0 ? (
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {photos.map((p, i) => (
            <li key={p} className={`overflow-hidden rounded-lg border ${i === 0 ? "border-navy ring-2 ring-navy/15" : "border-line"}`}>
              <div className="relative aspect-square bg-cream/40">
                <Image src={p} alt={i === 0 ? "Photo principale" : `Photo ${i + 1}`} fill unoptimized sizes="160px" className="object-contain" />
                {i === 0 && <span className="absolute left-1.5 top-1.5 rounded-full bg-navy px-2 py-0.5 text-[10px] font-semibold text-white">Principale</span>}
              </div>
              <div className="flex items-center justify-between gap-1 border-t border-line px-1.5 py-1">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Avancer la photo ${i + 1}`} className="rounded p-1 text-navy/70 hover:bg-cream disabled:opacity-30">
                  <ArrowLeft size={15} />
                </button>
                {i > 0 && (
                  <button type="button" onClick={() => makeMain(i)} aria-label={`Mettre la photo ${i + 1} en photo principale`} title="Photo principale" className="rounded p-1 text-navy/70 hover:bg-cream">
                    <Star size={15} />
                  </button>
                )}
                <button type="button" onClick={() => remove(i)} aria-label={`Retirer la photo ${i + 1}`} title="Retirer" className="rounded p-1 text-rose-dark hover:bg-rose/10">
                  <Trash2 size={15} />
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === photos.length - 1} aria-label={`Reculer la photo ${i + 1}`} className="rounded p-1 text-navy/70 hover:bg-cream disabled:opacity-30">
                  <ArrowRight size={15} />
                </button>
              </div>
            </li>
          ))}
          {pending.map((p) => (
            <li key={p.key} className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line bg-cream/30 p-2 text-center text-[11px] text-navy/70">
              <Loader2 size={18} className="animate-spin" />
              <span className="line-clamp-2 break-all">{p.label}</span>
            </li>
          ))}
        </ul>
      ) : (
        !busy && <p className="mt-3 rounded-lg bg-cream/50 px-3 py-4 text-center text-sm text-navy/70">Aucune photo : le site affichera le flacon illustré.</p>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <input ref={fileRef} id="photo-files" type="file" accept="image/*" multiple className="sr-only" onChange={(e) => onFiles(e.target.files)} disabled={room <= 0} />
          <label htmlFor="photo-files" className={`flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-navy bg-navy px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-navy-light sm:w-fit ${room <= 0 ? "pointer-events-none opacity-50" : ""}`}>
            <ImagePlus size={17} /> Choisir des photos sur l&apos;ordinateur ou le téléphone
          </label>
        </div>
        <div className="flex gap-2">
          <input
            value={drive}
            onChange={(e) => setDrive(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onDrive();
              }
            }}
            placeholder="Lien Google Drive de l'image"
            aria-label="Lien Google Drive de l'image"
            className="min-w-0 flex-1 rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-navy"
          />
          <button type="button" onClick={onDrive} disabled={!drive.trim() || room <= 0} aria-label="Ajouter l'image Google Drive" className="flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-semibold text-navy hover:bg-cream disabled:opacity-50">
            <HardDriveUpload size={16} /> Drive
          </button>
        </div>
        <div className="flex gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onUrl();
              }
            }}
            placeholder="Adresse d'image (https://…)"
            aria-label="Adresse d'une image"
            className="min-w-0 flex-1 rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-navy"
          />
          <button type="button" onClick={onUrl} disabled={!url.trim() || room <= 0} aria-label="Ajouter cette adresse d'image" className="flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-semibold text-navy hover:bg-cream disabled:opacity-50">
            <Link2 size={16} /> Ajouter
          </button>
        </div>
      </div>
      <p className="mt-2 text-xs text-navy/60">
        Drive : clic droit sur l&apos;image › Partager › Accès « Tous les utilisateurs disposant du lien » › Copier le lien. Sur téléphone Android, le premier bouton propose aussi Google Drive.
      </p>

      {errors.length > 0 && (
        <ul role="alert" className="mt-3 space-y-1 rounded-lg bg-rose/10 px-3 py-2 text-sm text-rose-dark">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
