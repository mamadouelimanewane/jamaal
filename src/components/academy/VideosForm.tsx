"use client";

import { useActionState } from "react";
import { saveAcademyVideos, type VideosState } from "@/lib/actions/academy";

/** Admin : un lien vidéo par module (facultatif). */
export function VideosForm({ modules, videos }: { modules: { id: string; title: string; badge: string }[]; videos: Record<string, string> }) {
  const [state, action, pending] = useActionState<VideosState, FormData>(saveAcademyVideos, { ok: false });
  return (
    <form action={action} className="space-y-3">
      {modules.map((m) => (
        <label key={m.id} className="block text-sm text-navy">
          <span className="font-medium">{m.title}</span> <span className="text-xs text-navy/55">· {m.badge}</span>
          <input name={`video-${m.id}`} defaultValue={videos[m.id] ?? ""} placeholder="https://youtu.be/… ou https://vimeo.com/…" className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm" />
        </label>
      ))}
      {state.error && <p role="alert" className="text-sm text-rose-dark">{state.error}</p>}
      {state.ok && <p role="status" className="text-sm text-emerald-800">{state.message}</p>}
      <button disabled={pending} className="rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{pending ? "Enregistrement…" : "Enregistrer les vidéos"}</button>
    </form>
  );
}
