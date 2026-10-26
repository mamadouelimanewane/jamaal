"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, Volume2, VolumeX, X } from "lucide-react";

const SOUND_KEY = "jamaal_son_notifications";
const POLL_MS = 20_000;
type Fresh = { id: string; title: string; message: string };

let audioCtx: AudioContext | null = null;
function ctx(): AudioContext | null {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    audioCtx ??= new AC();
    return audioCtx;
  } catch {
    return null;
  }
}

/** Sonnerie JAMAAL : deux notes douces (générées, aucun fichier à charger). */
export function playChime() {
  const c = ctx();
  if (!c) return;
  if (c.state === "suspended") void c.resume();
  const now = c.currentTime;
  [[880, 0], [1318.5, 0.16], [1760, 0.32]].forEach(([freq, at]) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, now + at);
    g.gain.exponentialRampToValueAtTime(0.35, now + at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.45);
    o.connect(g).connect(c.destination);
    o.start(now + at);
    o.stop(now + at + 0.5);
  });
  try {
    navigator.vibrate?.([120, 60, 120]);
  } catch {
    // vibration indisponible
  }
}

function readSoundPref() {
  try {
    return localStorage.getItem(SOUND_KEY) !== "0";
  } catch {
    return true;
  }
}

/**
 * Sonnerie des notifications : vérifie toutes les 20 s (et au retour sur l'onglet) s'il y a du nouveau ; à chaque
 * nouvelle notification, joue la sonnerie, affiche une alerte à l'écran et, application en arrière-plan, une
 * notification du téléphone / de l'ordinateur (si autorisée). Bouton pour couper ou remettre le son.
 */
export function NotificationAlerts({ unread, onCount }: { unread: number; onCount: (n: number) => void }) {
  const [sound, setSound] = useState(true);
  const [toast, setToast] = useState<Fresh | null>(null);
  const since = useRef<string | null>(null);
  const known = useRef(unread);
  const soundRef = useRef(true);

  useEffect(() => {
    const v = readSoundPref();
    soundRef.current = v;
    queueMicrotask(() => setSound(v));
    since.current = new Date().toISOString();
    // Les navigateurs n'autorisent le son qu'après un premier geste : on prépare l'audio au premier toucher.
    const unlock = () => ctx()?.resume().catch(() => {});
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const check = useCallback(async () => {
    if (!since.current) return;
    try {
      const res = await fetch(`/api/notifications/poll?after=${encodeURIComponent(since.current)}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { unread: number; fresh: Fresh[]; now: string };
      since.current = data.now;
      if (data.unread !== known.current) {
        known.current = data.unread;
        onCount(data.unread);
      }
      if (!data.fresh.length) return;
      const latest = data.fresh[0];
      if (soundRef.current) playChime();
      setToast(latest);
      if (document.visibilityState !== "visible" && "Notification" in window && Notification.permission === "granted") {
        const reg = await navigator.serviceWorker?.getRegistration("/admin/").catch(() => undefined);
        const opts = { body: latest.message.slice(0, 180), icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", tag: latest.id, data: { url: "/admin/notifications" } };
        if (reg) await reg.showNotification(latest.title, opts);
        else new Notification(latest.title, opts);
      }
    } catch {
      // réseau coupé : nouvel essai au prochain tour
    }
  }, [onCount]);

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void check();
    }, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && void check();
    document.addEventListener("visibilitychange", onVisible);
    // En arrière-plan (onglet caché), on vérifie quand même, moins souvent, pour la notification du téléphone.
    const bg = setInterval(() => {
      if (document.visibilityState !== "visible") void check();
    }, 60_000);
    return () => {
      clearInterval(id);
      clearInterval(bg);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [check]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 9000);
    return () => clearTimeout(t);
  }, [toast]);

  function toggle() {
    const next = !sound;
    setSound(next);
    soundRef.current = next;
    try {
      localStorage.setItem(SOUND_KEY, next ? "1" : "0");
    } catch {
      // préférence non mémorisée
    }
    if (next) {
      playChime();
      if ("Notification" in window && Notification.permission === "default") void Notification.requestPermission().catch(() => {});
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-pressed={sound}
        aria-label={sound ? "Couper la sonnerie des notifications" : "Activer la sonnerie des notifications"}
        title={sound ? "Sonnerie activée (cliquer pour couper)" : "Sonnerie coupée (cliquer pour activer)"}
        className="rounded-full p-2 text-navy hover:bg-cream"
      >
        {sound ? <Volume2 size={18} /> : <VolumeX size={18} className="text-navy/50" />}
      </button>
      {toast && createPortal(
        <div role="status" aria-live="polite" className="fixed bottom-4 right-4 z-[60] w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-line bg-white p-4 shadow-xl">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 rounded-full bg-rose/15 p-1.5 text-rose-dark"><Bell size={16} /></span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-navy">{toast.title}</p>
              <p className="mt-0.5 line-clamp-4 whitespace-pre-line text-xs text-navy/75">{toast.message}</p>
              <Link href="/admin/notifications" onClick={() => setToast(null)} className="mt-1.5 inline-block text-xs font-semibold text-rose-dark hover:underline">Voir les notifications</Link>
            </div>
            <button type="button" onClick={() => setToast(null)} aria-label="Fermer" className="rounded-full p-1 text-navy/60 hover:bg-cream"><X size={14} /></button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
