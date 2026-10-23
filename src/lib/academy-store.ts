/**
 * Académie (serveur) : vidéos des modules (réglées par l'admin) et badges obtenus par un consultant.
 */
import { prisma } from "@/lib/prisma";
import { academyProgress, ALL_MODULES, videoEmbed } from "@/data/academy";

const VIDEOS_KEY = "academie_videos";

export async function getAcademyVideos(): Promise<Record<string, string>> {
  const row = await prisma.setting.findUnique({ where: { key: VIDEOS_KEY } }).catch(() => null);
  try {
    const v = row ? (JSON.parse(row.value) as Record<string, unknown>) : {};
    return Object.fromEntries(Object.entries(v).filter(([k, url]) => ALL_MODULES.some((m) => m.id === k) && typeof url === "string" && videoEmbed(url)) as [string, string][]);
  } catch {
    return {};
  }
}

export async function setAcademyVideos(videos: Record<string, string>) {
  const clean = Object.fromEntries(Object.entries(videos).filter(([k, url]) => ALL_MODULES.some((m) => m.id === k) && videoEmbed(url)));
  const value = JSON.stringify(clean);
  await prisma.setting.upsert({ where: { key: VIDEOS_KEY }, create: { key: VIDEOS_KEY, value }, update: { value } });
}

/** Progression d'un consultant à l'Académie. */
export async function consultantAcademy(consultantId: string) {
  const results = await prisma.quizResult.findMany({ where: { consultantId }, select: { quizId: true, score: true, total: true, updatedAt: true } });
  return { results, progress: academyProgress(results) };
}

/** Badges obtenus (pour la boutique et la liste des consultants). */
export async function earnedBadges(consultantId: string) {
  return (await consultantAcademy(consultantId)).progress.filter((p) => p.earned);
}
