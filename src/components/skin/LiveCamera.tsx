"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, RefreshCw, X } from "lucide-react";

/**
 * Caméra en direct (selfie) : aperçu vidéo et bouton de prise de vue, sans quitter la page. Plus fiable que
 * le champ « fichier » des téléphones, qui ouvre parfois la galerie au lieu de l'appareil photo (Android,
 * navigateurs intégrés). Si la caméra est refusée ou absente, onFallback ouvre l'appareil photo du téléphone.
 */
export function LiveCamera({ onPhoto, onClose, onFallback }: { onPhoto: (f: File) => void; onClose: () => void; onFallback: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    async function start() {
      setReady(false);
      stream.current?.getTracks().forEach((t) => t.stop());
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Caméra non disponible dans ce navigateur.");
        return;
      }
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false });
        if (stop) return s.getTracks().forEach((t) => t.stop());
        stream.current = s;
        if (video.current) {
          video.current.srcObject = s;
          await video.current.play().catch(() => {});
        }
        setReady(true);
        setError(null);
      } catch {
        setError("Accès à la caméra refusé ou impossible.");
      }
    }
    void start();
    return () => {
      stop = true;
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, [facing]);

  function shoot() {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext("2d")!;
    // Selfie : l'image enregistrée est remise à l'endroit (l'aperçu est en miroir, comme un miroir).
    if (facing === "user") {
      ctx.translate(c.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(v, 0, 0);
    c.toBlob((b) => {
      if (!b) return;
      stream.current?.getTracks().forEach((t) => t.stop());
      onPhoto(new File([b], "selfie.jpg", { type: "image/jpeg" }));
    }, "image/jpeg", 0.9);
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Prendre un selfie" className="fixed inset-0 z-[70] flex flex-col bg-black">
      <div className="flex items-center justify-between p-3 text-white">
        <p className="text-sm">De face, en lumière naturelle</p>
        <button type="button" onClick={onClose} aria-label="Fermer la caméra" className="rounded-full p-2 hover:bg-white/10"><X size={22} /></button>
      </div>
      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        <video ref={video} playsInline muted className={`h-full w-full object-cover ${facing === "user" ? "-scale-x-100" : ""}`} />
        {!ready && !error && <Loader2 size={36} className="absolute animate-spin text-white" />}
        {error && (
          <div className="absolute inset-x-6 rounded-2xl bg-white p-5 text-center text-sm text-navy">
            <p>{error}</p>
            <button type="button" onClick={onFallback} className="mt-3 inline-flex items-center gap-2 rounded-full bg-navy px-5 py-3 font-semibold text-white">
              <Camera size={16} /> Ouvrir l&apos;appareil photo du téléphone
            </button>
          </div>
        )}
        {ready && <div aria-hidden="true" className="pointer-events-none absolute h-[62%] w-[58%] rounded-[50%] border-2 border-white/70" />}
      </div>
      <div className="flex items-center justify-around p-5 pb-8">
        <span className="w-12" />
        <button type="button" onClick={shoot} disabled={!ready} aria-label="Prendre la photo" className="h-18 w-18 rounded-full border-4 border-white bg-white/90 disabled:opacity-40" style={{ height: 72, width: 72 }} />
        <button type="button" onClick={() => setFacing(facing === "user" ? "environment" : "user")} aria-label="Changer de caméra" className="rounded-full p-3 text-white hover:bg-white/10"><RefreshCw size={22} /></button>
      </div>
    </div>
  );
}
