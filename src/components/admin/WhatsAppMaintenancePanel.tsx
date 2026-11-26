"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Download, Loader2, RotateCcw, Trash2 } from "lucide-react";

export function WhatsAppMaintenancePanel({
  totalThreads,
  totalMessages,
  clearedAt,
}: {
  totalThreads: number;
  totalMessages: number;
  clearedAt: string | null;
}) {
  const router = useRouter();
  const [confirmClear, setConfirmClear] = useState(false);
  const [busy, setBusy] = useState<"clear" | "restore" | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleClearInbox() {
    if (!confirmClear || busy) return;
    setBusy("clear");
    setFeedback(null);
    try {
      const res = await fetch("/api/whatsapp/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear" }),
      });
      const json = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      if (!res.ok || !json.ok) {
        setFeedback({ ok: false, text: json.error || "Échec du nettoyage." });
      } else {
        setConfirmClear(false);
        setFeedback({ ok: true, text: json.message || "Messagerie vidée avec succès." });
        router.refresh();
      }
    } catch {
      setFeedback({ ok: false, text: "Erreur réseau lors du nettoyage." });
    } finally {
      setBusy(null);
    }
  }

  async function handleRestoreFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy("restore");
    setFeedback(null);
    try {
      const rawText = await file.text();
      const backup = JSON.parse(rawText) as unknown;
      const res = await fetch("/api/whatsapp/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore", backup }),
      });
      const json = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      if (!res.ok || !json.ok) {
        setFeedback({ ok: false, text: json.error || "Impossible de restaurer ce fichier." });
      } else {
        setFeedback({ ok: true, text: json.message || "Restauration terminée." });
        router.refresh();
      }
    } catch {
      setFeedback({ ok: false, text: "Fichier JSON invalide ou illisible." });
    } finally {
      setBusy(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-2xs">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-3.5">
        <div>
          <h2 className="font-serif-display text-lg font-semibold text-navy">
            Sauvegarde, nettoyage & restauration de la messagerie
          </h2>
          <p className="mt-0.5 text-xs text-navy/70">
            Base actuelle : <strong>{totalThreads}</strong> conversation{totalThreads > 1 ? "s" : ""} ·{" "}
            <strong>{totalMessages}</strong> message{totalMessages > 1 ? "s" : ""}. Les modèles Meta et les textes automatiques JAMAAL ne sont jamais supprimés.
          </p>
          {clearedAt && (
            <p className="mt-1 text-[11px] font-medium text-emerald-800">
              Coupure anti-réimport KwingoChat active depuis le{" "}
              {new Date(clearedAt).toLocaleString("fr-FR", {
                dateStyle: "short",
                timeStyle: "short",
                timeZone: "Africa/Dakar",
              })}
              .
            </p>
          )}
        </div>
      </div>

      {feedback && (
        <p
          role={feedback.ok ? "status" : "alert"}
          className={`mt-3 rounded-xl border px-3.5 py-2.5 text-xs font-medium ${
            feedback.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-rose/30 bg-rose/10 text-rose-dark"
          }`}
        >
          {feedback.text}
        </p>
      )}

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {/* 1. Sauvegarde JSON */}
        <div className="flex flex-col justify-between rounded-xl border border-line bg-cream/25 p-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-navy">1. Sauvegarder</p>
            <p className="mt-1 text-xs text-navy/70">
              Téléchargez l&apos;intégralité des conversations et messages au format JSON avant tout nettoyage.
            </p>
          </div>
          <a
            href="/api/whatsapp/maintenance"
            className="mt-3 inline-flex items-center justify-center gap-2 rounded-full bg-navy px-4 py-2 text-xs font-semibold text-white transition hover:bg-navy/90"
          >
            <Download size={14} />
            Télécharger la sauvegarde JSON
          </a>
        </div>

        {/* 2. Vider toute la messagerie */}
        <div className="flex flex-col justify-between rounded-xl border border-rose/30 bg-rose/5 p-4">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-dark">
              <AlertTriangle size={14} /> 2. Vider la messagerie
            </p>
            <p className="mt-1 text-xs text-navy/75">
              Supprime <strong>tous</strong> les messages et conversations (y compris ceux du jour) et bloque le ré-import KwingoChat antérieur. Les modèles sont conservés.
            </p>
            <label className="mt-2.5 flex cursor-pointer items-start gap-2 text-[11px] text-navy">
              <input
                type="checkbox"
                checked={confirmClear}
                onChange={(e) => setConfirmClear(e.target.checked)}
                className="mt-0.5 rounded border-line"
              />
              <span>J&apos;ai téléchargé la sauvegarde et je confirme vouloir vider tous les messages.</span>
            </label>
          </div>
          <button
            type="button"
            disabled={!confirmClear || busy !== null}
            onClick={() => void handleClearInbox()}
            className="mt-3 inline-flex items-center justify-center gap-2 rounded-full bg-rose-dark px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {busy === "clear" ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            <span>Vider tous les messages</span>
          </button>
        </div>

        {/* 3. Restaurer depuis un fichier JSON */}
        <div className="flex flex-col justify-between rounded-xl border border-line bg-cream/25 p-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-navy">3. Restaurer</p>
            <p className="mt-1 text-xs text-navy/70">
              Réimportez un fichier de sauvegarde JSON précédemment téléchargé pour retrouver l&apos;historique complet.
            </p>
          </div>
          <div className="mt-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={(e) => void handleRestoreFile(e)}
              className="hidden"
              id="whatsapp-restore-json"
            />
            <label
              htmlFor="whatsapp-restore-json"
              className={`inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-navy bg-white px-4 py-2 text-xs font-semibold text-navy transition hover:bg-cream ${
                busy !== null ? "pointer-events-none opacity-50" : ""
              }`}
            >
              {busy === "restore" ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
              <span>Restaurer une sauvegarde JSON</span>
            </label>
          </div>
        </div>
      </div>
    </section>
  );
}
