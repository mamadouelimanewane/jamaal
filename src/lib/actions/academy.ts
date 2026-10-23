"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "./auth-guard";
import { logActivity } from "@/lib/activity-log";
import { ALL_MODULES, videoEmbed } from "@/data/academy";
import { setAcademyVideos } from "@/lib/academy-store";

export type VideosState = { ok: boolean; message?: string; error?: string };

/** Admin : liens vidéo (YouTube, Vimeo ou fichier) des modules de l'Académie. */
export async function saveAcademyVideos(_prev: VideosState, fd: FormData): Promise<VideosState> {
  const session = await requireAdmin("revendeurs");
  const videos: Record<string, string> = {};
  const bad: string[] = [];
  for (const m of ALL_MODULES) {
    const url = String(fd.get(`video-${m.id}`) ?? "").trim();
    if (!url) continue;
    if (videoEmbed(url)) videos[m.id] = url;
    else bad.push(m.title);
  }
  if (bad.length) return { ok: false, error: `Lien non reconnu (YouTube, Vimeo ou fichier .mp4) : ${bad.join(", ")}.` };
  await setAcademyVideos(videos);
  await logActivity(session, "Vidéos de l'Académie modifiées", "Setting", "academie_videos");
  revalidatePath("/admin/academie");
  return { ok: true, message: `${Object.keys(videos).length} vidéo(s) enregistrée(s).` };
}
