"use client";

import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

/** Lecture à voix haute (voix française du téléphone), pour les livreurs qui lisent difficilement. */
export function speak(text: string) {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return false;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "fr-FR";
    u.rate = 0.92;
    const fr = synth.getVoices().find((v) => v.lang?.toLowerCase().startsWith("fr"));
    if (fr) u.voice = fr;
    synth.speak(u);
    return true;
  } catch {
    return false;
  }
}

/** Bouton « Écouter » : lit la consigne de l'écran. Caché si le téléphone ne sait pas lire à voix haute. */
export function ListenButton({ text, label = "Écouter", tone = "light" }: { text: string; label?: string; tone?: "light" | "dark" }) {
  const [ok, setOk] = useState(false);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setOk(typeof window !== "undefined" && "speechSynthesis" in window), 0);
    return () => clearTimeout(t);
  }, []);
  if (!ok) return null;
  const click = () => {
    if (on) {
      window.speechSynthesis.cancel();
      setOn(false);
      return;
    }
    if (speak(text)) {
      setOn(true);
      const end = () => setOn(false);
      setTimeout(end, Math.min(20_000, 1500 + text.length * 70));
    }
  };
  return (
    <button
      type="button"
      onClick={click}
      aria-label={on ? "Arrêter la lecture" : `${label} la consigne`}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold ${tone === "dark" ? "bg-white/20 text-white" : "bg-[#FFE8A3] text-[#5A4100]"}`}
    >
      {on ? <VolumeX size={18} /> : <Volume2 size={18} />} {on ? "Stop" : label}
    </button>
  );
}
