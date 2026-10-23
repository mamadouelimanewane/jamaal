"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Square, Trash2 } from "lucide-react";
import { uploadGiftVoice } from "@/lib/actions/gifts";

const MAX_SEC = 60;

/** Message vocal pour un cadeau : enregistrer (1 minute au plus), réécouter, supprimer. Renvoie l'adresse du fichier. */
export function VoiceRecorder({ value, onChange }: { value: string | null; onChange: (url: string | null) => void }) {
  const [state, setState] = useState<"idle" | "rec" | "upload">("idle");
  const [sec, setSec] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
    rec.current?.stream.getTracks().forEach((t) => t.stop());
  }, []);

  useEffect(() => {
    if (state === "rec" && sec >= MAX_SEC && rec.current?.state === "recording") rec.current.stop();
  }, [sec, state]);

  async function start() {
    setError(null);
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) return setError("Votre navigateur ne permet pas d'enregistrer : écrivez votre message.");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = ["audio/webm", "audio/mp4", "audio/ogg"].find((t) => MediaRecorder.isTypeSupported?.(t)) ?? "";
      const r = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      const chunks: Blob[] = [];
      r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      r.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timer.current) clearInterval(timer.current);
        const blob = new Blob(chunks, { type: r.mimeType || type || "audio/webm" });
        if (blob.size < 2000) return setState("idle");
        setState("upload");
        const fd = new FormData();
        fd.append("voice", new File([blob], "message", { type: blob.type.split(";")[0] }));
        const res = await uploadGiftVoice(fd).catch(() => ({ ok: false as const, error: "Envoi impossible, réessayez." }));
        setState("idle");
        if (res.ok) onChange(res.url);
        else setError(res.error);
      };
      rec.current = r;
      r.start();
      setSec(0);
      setState("rec");
      timer.current = setInterval(() => setSec((s) => s + 1), 1000);
    } catch {
      setError("Micro refusé : autorisez le micro, ou écrivez votre message.");
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-3">
      {value ? (
        <div className="flex items-center gap-2">
          <audio src={value} controls className="h-10 min-w-0 flex-1" />
          <button type="button" onClick={() => onChange(null)} aria-label="Supprimer le message vocal" className="rounded-full p-2 text-navy/60 hover:bg-cream hover:text-rose-dark"><Trash2 size={18} /></button>
        </div>
      ) : state === "rec" ? (
        <button type="button" onClick={() => rec.current?.stop()} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-rose-dark px-4 py-3 text-sm font-semibold text-white">
          <Square size={14} /> Arrêter ({MAX_SEC - sec} s)
        </button>
      ) : (
        <button type="button" onClick={start} disabled={state === "upload"} className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-line px-4 py-3 text-sm font-semibold text-navy hover:bg-cream disabled:opacity-60">
          {state === "upload" ? <Loader2 size={16} className="animate-spin" /> : <Mic size={16} />} {state === "upload" ? "Enregistrement…" : "Ajouter un message vocal (facultatif)"}
        </button>
      )}
      {error && <p role="alert" className="mt-2 text-xs text-rose-dark">{error}</p>}
    </div>
  );
}
