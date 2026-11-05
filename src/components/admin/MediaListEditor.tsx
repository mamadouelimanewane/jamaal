"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Film, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { MediaView } from "@/components/MediaView";
import { isImageFile, isVideoFile, isVideoUrl, type MediaScope } from "@/lib/media";
import { uploadMedia } from "@/lib/media-upload";

type Pending = { key: string; label: string; percent: number; video: boolean };

/** Champ invisible et invalide tant qu'un fichier s'envoie : le formulaire ne part pas avant la fin. */
function UploadGuard() {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.setCustomValidity("Attendez la fin de l'envoi des photos et vidéos."), []);
  return <input ref={ref} type="text" defaultValue="" className="pointer-events-none absolute h-px w-px opacity-0" aria-hidden="true" tabIndex={-1} />;
}

/**
 * Photos et vidéos choisies dans la galerie du téléphone ou de l'ordinateur, envoyées directement vers le
 * stockage du site (vidéos jusqu'à 100 Mo, avec la progression). Ordre modifiable, suppression.
 * Le formulaire reçoit la liste (JSON) dans le champ « name », ou l'adresse seule si max = 1.
 */
export function MediaListEditor({
  name,
  initial,
  scope,
  max,
  title,
  hint,
  videos = true,
  onChange,
}: {
  name?: string;
  initial: string[];
  scope: MediaScope;
  max: number;
  title: string;
  hint?: string;
  /** Accepter les vidéos (sinon photos seules). */
  videos?: boolean;
  onChange?: (list: string[]) => void;
}) {
  const [items, setItems] = useState<string[]>(initial);
  const [pending, setPending] = useState<Pending[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const id = `media-${scope}-${name ?? "x"}`;
  const room = max - items.length - pending.length;

  const set = (fn: (l: string[]) => string[]) => setItems(fn);
  const notify = useRef(onChange);
  useEffect(() => {
    notify.current = onChange;
  });
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    notify.current?.(items);
  }, [items]);

  async function onFiles(list: FileList | null) {
    setErrors([]);
    const all = [...(list ?? [])];
    const ok = all.filter((f) => isImageFile(f) || (videos && isVideoFile(f)));
    const errs: string[] = [];
    if (ok.length < all.length) errs.push(videos ? "Seules les photos et les vidéos sont acceptées." : "Seules les photos sont acceptées.");
    const take = ok.slice(0, Math.max(0, room));
    if (ok.length > take.length) errs.push(`${max} fichier(s) au plus : les suivants sont ignorés.`);
    setErrors(errs);
    if (fileRef.current) fileRef.current.value = "";
    // Un à la fois : l'ordre choisi est gardé et la connexion du téléphone n'est pas saturée.
    for (const f of take) {
      const key = `${Date.now()}-${Math.random()}`;
      setPending((p) => [...p, { key, label: f.name || "fichier", percent: 0, video: isVideoFile(f) }]);
      try {
        const url = await uploadMedia(f, scope, (percent) => setPending((p) => p.map((x) => (x.key === key ? { ...x, percent } : x))));
        set((l) => (l.includes(url) ? l : max === 1 ? [url] : [...l, url]));
      } catch (e) {
        setErrors((es) => [...es, `${f.name || "Fichier"} : ${e instanceof Error ? e.message : "échec"}`]);
      } finally {
        setPending((p) => p.filter((x) => x.key !== key));
      }
    }
  }

  const move = (i: number, d: -1 | 1) =>
    set((l) => {
      const j = i + d;
      if (j < 0 || j >= l.length) return l;
      const next = [...l];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const remove = (i: number) => set((l) => l.filter((_, k) => k !== i));
  const busy = pending.length > 0;
  const accept = videos ? "image/*,video/*" : "image/*";

  return (
    <div className="relative rounded-xl border border-line bg-white p-4">
      {name && <input type="hidden" name={name} value={max === 1 ? (items[0] ?? "") : JSON.stringify(items)} />}
      {busy && <UploadGuard />}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-navy">
          {title} {max > 1 && <span className="font-normal text-navy/60">({items.length}/{max})</span>}
        </p>
        {busy && (
          <span className="flex items-center gap-1.5 text-xs text-navy/70">
            <Loader2 size={14} className="animate-spin" /> Envoi en cours…
          </span>
        )}
      </div>
      {hint && <p className="mt-1 text-xs text-navy/65">{hint}</p>}

      {(items.length > 0 || busy) && (
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {items.map((u, i) => (
            <li key={u} className="overflow-hidden rounded-lg border border-line">
              <div className="relative aspect-square bg-cream/40">
                <MediaView src={u} alt={`Fichier ${i + 1}`} className="h-full w-full" />
                {isVideoUrl(u) && (
                  <span className="pointer-events-none absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white">
                    <Film size={11} /> Vidéo
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between gap-1 border-t border-line px-1.5 py-1">
                {max > 1 ? (
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Avancer le fichier ${i + 1}`} className="rounded p-1 text-navy/70 hover:bg-cream disabled:opacity-30">
                    <ArrowLeft size={15} />
                  </button>
                ) : <span />}
                <button type="button" onClick={() => remove(i)} aria-label={`Retirer le fichier ${i + 1}`} title="Retirer" className="rounded p-1 text-rose-dark hover:bg-rose/10">
                  <Trash2 size={15} />
                </button>
                {max > 1 ? (
                  <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label={`Reculer le fichier ${i + 1}`} className="rounded p-1 text-navy/70 hover:bg-cream disabled:opacity-30">
                    <ArrowRight size={15} />
                  </button>
                ) : <span />}
              </div>
            </li>
          ))}
          {pending.map((p) => (
            <li key={p.key} className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-line bg-cream/30 p-2 text-center text-[11px] text-navy/70">
              <Loader2 size={18} className="animate-spin" />
              <span className="line-clamp-2 break-all">{p.label}</span>
              {p.video && (
                <span className="w-full">
                  <span className="block h-1.5 w-full overflow-hidden rounded-full bg-line">
                    <span className="block h-full rounded-full bg-navy transition-all" style={{ width: `${p.percent}%` }} />
                  </span>
                  <span className="mt-0.5 block font-semibold">{p.percent} %</span>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <input ref={fileRef} id={id} type="file" accept={accept} multiple={max > 1} className="sr-only" onChange={(e) => onFiles(e.target.files)} disabled={room <= 0 && max > 1} />
      <label
        htmlFor={id}
        className={`mt-3 flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-navy/30 bg-cream/40 px-4 py-5 text-center transition hover:border-navy hover:bg-cream ${room <= 0 && max > 1 ? "pointer-events-none opacity-50" : ""}`}
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-navy text-white">
          <ImagePlus size={22} />
        </span>
        <span className="text-sm font-semibold text-navy">
          {max === 1 && items.length ? "Remplacer" : videos ? "Ajouter des photos ou des vidéos" : "Ajouter des photos"}
        </span>
        <span className="text-xs text-navy/60">
          Depuis la galerie du téléphone ou un dossier de l&apos;ordinateur{videos ? " · vidéo : 100 Mo au plus (MP4, MOV, WebM)" : ""}
        </span>
      </label>

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
