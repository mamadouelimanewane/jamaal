"use client";

import { Mic, Search } from "lucide-react";
import { useState } from "react";
import { useSearchStore } from "@/lib/search-store";

/** Champ de la page de résultats : ouvre la recherche instantanée avec le texte courant. */
export function SearchPageInput({ initial }: { initial: string }) {
  const open = useSearchStore((s) => s.open);
  const [voiceMessage, setVoiceMessage] = useState("");
  const [language, setLanguage] = useState<"fr-FR" | "wo-SN">("fr-FR");
  function startVoiceSearch() {
    type VoiceResult = { transcript: string };
    type VoiceRecognition = {
      lang: string;
      interimResults: boolean;
      maxAlternatives: number;
      onresult: ((event: { results: ArrayLike<ArrayLike<VoiceResult>> }) => void) | null;
      onerror: ((event: { error: string }) => void) | null;
      onend: (() => void) | null;
      start: () => void;
    };
    const speechWindow = window as Window & { SpeechRecognition?: new () => VoiceRecognition; webkitSpeechRecognition?: new () => VoiceRecognition };
    const SpeechRecognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceMessage("La recherche vocale n’est pas disponible dans ce navigateur. Vous pouvez saisir votre demande.");
      return;
    }
    setVoiceMessage("Écoute en cours… décrivez le parfum que vous cherchez.");
    const recognition = new SpeechRecognition();
    recognition.lang = language;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      if (transcript) {
        setVoiceMessage(`Recherche : « ${transcript} »`);
        open(transcript);
      } else setVoiceMessage("Je n’ai pas compris. Réessayez ou saisissez votre demande.");
    };
    recognition.onerror = (event) => setVoiceMessage(event.error === "not-allowed" ? "Autorisez le microphone dans le navigateur pour utiliser la recherche vocale." : language === "wo-SN" ? "La reconnaissance wolof dépend de la prise en charge du navigateur. Essayez en français ou saisissez votre demande." : "La recherche vocale n’a pas abouti. Réessayez ou saisissez votre demande.");
    recognition.onend = () => setVoiceMessage((current) => current === "Écoute en cours… décrivez le parfum que vous cherchez." ? "Aucune parole détectée. Réessayez ou saisissez votre demande." : current);
    try { recognition.start(); }
    catch { setVoiceMessage("Impossible de démarrer le microphone. Vérifiez les autorisations du navigateur."); }
  }
  return (
    <div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => open(initial)}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-[#eadfda] bg-white px-5 py-4 text-left shadow-sm transition hover:border-[#c9997a] sm:py-5"
        >
          <Search size={22} className="shrink-0 text-[#9c6254]" />
          <span className={`flex-1 truncate font-serif-display text-xl sm:text-2xl ${initial ? "text-navy" : "text-navy/40"}`}>{initial || "Un parfum, une marque, un code…"}</span>
          <span className="hidden text-xs text-navy/50 sm:block">Modifier</span>
        </button>
        <button type="button" onClick={startVoiceSearch} aria-label="Rechercher un parfum à la voix" title="Rechercher à la voix" className="inline-flex shrink-0 items-center gap-2 rounded-2xl border border-[#eadfda] bg-white px-4 text-sm font-semibold text-navy shadow-sm hover:border-[#c9997a] hover:bg-[#fdf9f6]">
          <Mic size={20} className="text-[#9c6254]" /><span className="hidden sm:inline">À la voix</span>
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-navy/60">
        <label className="flex items-center gap-2">Langue de reconnaissance
          <select value={language} onChange={(e) => setLanguage(e.target.value as "fr-FR" | "wo-SN")} className="rounded-lg border border-line bg-white px-2 py-1 text-navy">
            <option value="fr-FR">Français</option><option value="wo-SN">Wolof (si pris en charge)</option>
          </select>
        </label>
        <span>Décrivez le parfum, l’occasion ou le budget recherché.</span>
      </div>
      {voiceMessage && <p role="status" className="mt-2 text-xs text-navy/70">{voiceMessage}</p>}
    </div>
  );
}
