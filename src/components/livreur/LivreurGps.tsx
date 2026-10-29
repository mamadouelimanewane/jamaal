"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MapPin, Navigation, TriangleAlert } from "lucide-react";
import { shouldSend, type Fix } from "@/lib/geo-track";

export type GpsDetail = { lat: number; lng: number; accuracy: number | null; heading: number | null; speed: number | null; at: number };
export const GPS_EVENT = "jamaal-gps";

type State = "off" | "starting" | "on" | "denied" | "unavailable";

/**
 * GPS de l'application Livreur. Pendant les livraisons, le suivi démarre tout seul et ne peut pas être
 * coupé : la position part au serveur (au plus toutes les 5 s, dès 20 m parcourus, sinon toutes les 45 s),
 * le client et l'équipe la voient en direct. L'écran reste allumé pendant la tournée quand le téléphone le permet.
 * Limite d'une application web : le suivi s'arrête si l'application est fermée ou le téléphone verrouillé.
 */
export function LivreurGps({ active }: { active: boolean }) {
  const [state, setState] = useState<State>("off");
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [failing, setFailing] = useState(false);
  const [now, setNow] = useState(0);
  const watch = useRef<number | null>(null);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);
  const last = useRef<Fix | null>(null);
  const sending = useRef(false);
  const wake = useRef<{ release: () => Promise<void> } | null>(null);

  const queued = useRef<GpsDetail | null>(null);
  const send = useCallback(async (first: GpsDetail): Promise<void> => {
    // Une position arrivée pendant un envoi part juste après (la plus récente seulement).
    if (sending.current) {
      queued.current = first;
      return;
    }
    sending.current = true;
    let p: GpsDetail | null = first;
    while (p) {
      try {
        const res = await fetch("/api/livreur/position", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p), keepalive: true });
        if (res.ok) {
          last.current = { lat: p.lat, lng: p.lng, at: p.at };
          setSentAt(p.at);
          setFailing(false);
        } else setFailing(true);
      } catch {
        setFailing(true);
      }
      const next: GpsDetail | null = queued.current;
      queued.current = null;
      p = next && shouldSend(last.current, next) ? next : null;
    }
    sending.current = false;
  }, []);

  const keepAwake = useCallback(async () => {
    try {
      const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
      if (nav.wakeLock && !wake.current && document.visibilityState === "visible") wake.current = await nav.wakeLock.request("screen");
    } catch {
      // économie d'énergie ou navigateur sans prise en charge
    }
  }, []);

  const start = useCallback(() => {
    if (watch.current !== null) return;
    if (!("geolocation" in navigator)) {
      setState("unavailable");
      return;
    }
    setState("starting");
    const onFix = (pos: GeolocationPosition) => {
      const p: GpsDetail = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy), heading: pos.coords.heading != null && Number.isFinite(pos.coords.heading) ? pos.coords.heading : null, speed: pos.coords.speed != null && Number.isFinite(pos.coords.speed) ? pos.coords.speed : null, at: new Date().getTime() };
      setState("on");
      setAccuracy(p.accuracy);
      window.dispatchEvent(new CustomEvent<GpsDetail>(GPS_EVENT, { detail: p }));
      if (shouldSend(last.current, p)) void send(p);
    };
    watch.current = navigator.geolocation.watchPosition(onFix, (err) => setState(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable"), { enableHighAccuracy: true, maximumAge: 5_000, timeout: 30_000 });
    // Certains téléphones suspendent le suivi continu : relevé de secours toutes les 30 s.
    poll.current = setInterval(() => navigator.geolocation.getCurrentPosition(onFix, () => {}, { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 }), 30_000);
    void keepAwake();
  }, [keepAwake, send]);

  const stop = useCallback(() => {
    if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
    watch.current = null;
    if (poll.current) clearInterval(poll.current);
    poll.current = null;
    void wake.current?.release().catch(() => {});
    wake.current = null;
    setState("off");
  }, []);

  // Démarrage automatique pendant les livraisons ; reprise quand l'application revient au premier plan.
  useEffect(() => {
    const t = setTimeout(() => {
      if (active) start();
    }, 0);
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      wake.current = null;
      if (active) {
        start();
        void keepAwake();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [active, start, keepAwake]);

  useEffect(() => () => {
    if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
    if (poll.current) clearInterval(poll.current);
  }, []);

  useEffect(() => {
    const i = setInterval(() => setNow(new Date().getTime()), 5_000);
    return () => clearInterval(i);
  }, []);

  if (state === "denied")
    return (
      <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-900">
        <TriangleAlert size={16} className="mt-0.5 shrink-0" />
        <span>
          <strong>Localisation refusée.</strong> Elle est obligatoire pendant les livraisons. Ouvrez les réglages du téléphone › Applications (ou Safari) › Localisation, autorisez JAMAAL, puis revenez ici.
          <button type="button" onClick={() => { stop(); start(); }} className="ml-1 font-semibold underline">Réessayer</button>
        </span>
      </div>
    );
  if (state === "unavailable")
    return (
      <div role="alert" className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950">
        <TriangleAlert size={16} className="mt-0.5 shrink-0" />
        <span>Signal GPS introuvable : activez la localisation du téléphone et sortez à découvert. <button type="button" onClick={() => { stop(); start(); }} className="font-semibold underline">Réessayer</button></span>
      </div>
    );

  if (state === "off")
    return (
      <button type="button" onClick={start} className="inline-flex items-center gap-2 rounded-full bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-light">
        <MapPin size={16} /> Activer ma position
      </button>
    );

  const secs = sentAt && now ? Math.max(0, Math.round((now - sentAt) / 1000)) : null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span role="status" className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${failing ? "bg-amber-100 text-amber-950" : "bg-emerald-600 text-white"}`}>
        <Navigation size={16} className={state === "on" && !failing ? "animate-pulse" : ""} />
        {state === "starting" ? "Recherche du GPS…" : failing ? "GPS actif · réseau faible, nouvel envoi bientôt" : `GPS en direct${accuracy != null ? ` · ± ${accuracy} m` : ""}${secs != null ? ` · envoyé il y a ${secs} s` : ""}`}
      </span>
      {!active && (
        <button type="button" onClick={stop} className="rounded-full border border-line px-3 py-2 text-xs font-semibold text-navy hover:bg-cream">Couper</button>
      )}
    </div>
  );
}
