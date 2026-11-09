"use client";

import { useEffect, useState } from "react";

const KEY = "jamaal-livreur-vues";

function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [0, 0.25, 0.5].forEach((t, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = i === 2 ? 1046 : 784;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.22);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.25);
    });
  } catch {
    // son indisponible
  }
}

/**
 * Alerte « Nouvelle course » dans l'application Livreur : dès qu'une course attribuée apparaît (la page se
 * met à jour toute seule), sonnerie, vibration et bandeau, même si le message WhatsApp n'est pas arrivé.
 */
export function NewCourseAlert({ courses }: { courses: { id: string; name: string; place: string }[] }) {
  const [fresh, setFresh] = useState<{ id: string; name: string; place: string }[]>([]);

  useEffect(() => {
    let seen: string[] = [];
    try {
      seen = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    } catch {
      seen = [];
    }
    const first = !seen.length && !localStorage.getItem(KEY);
    const nouveaux = courses.filter((c) => !seen.includes(c.id));
    try {
      localStorage.setItem(KEY, JSON.stringify([...new Set([...seen, ...courses.map((c) => c.id)])].slice(-200)));
    } catch {
      // stockage indisponible
    }
    if (!nouveaux.length || first) return;
    const t = setTimeout(() => setFresh(nouveaux), 0);
    beep();
    navigator.vibrate?.([300, 150, 300, 150, 500]);
    return () => clearTimeout(t);
  }, [courses]);

  if (!fresh.length) return null;
  return (
    <div role="alert" className="mt-3 animate-pulse rounded-3xl border-4 border-[#16A34A] bg-[#DCFCE7] p-4 text-[#14532D]">
      <p className="text-xl font-extrabold">🛵 Nouvelle course !</p>
      <ul className="mt-1 text-base font-semibold">
        {fresh.map((c) => (
          <li key={c.id}>{c.name} · {c.place}</li>
        ))}
      </ul>
      <button type="button" onClick={() => setFresh([])} className="mt-3 w-full rounded-2xl bg-[#16A34A] px-4 py-3 text-lg font-extrabold text-white">J&apos;ai vu 👍</button>
    </div>
  );
}
