import { requireAdminForApi } from "@/lib/api-guard";
import { fetchChoganDetail, fetchChoganImage } from "@/lib/chogan/client";
import { photoFileName } from "@/lib/chogan/preview";
import { createZip, type ZipEntry } from "@/lib/zip";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/** Nombre de fiches par archive : au-delà, la page d'import propose plusieurs archives. */
const MAX_FICHES = 10;

/** GET /api/admin/chogan-photos?n=9479,9474 → ZIP des photos de ces fiches Chogan, nommées proprement. */
export async function GET(req: Request) {
  const forbidden = await requireAdminForApi();
  if (forbidden) return forbidden;

  const numbers = [...new Set((new URL(req.url).searchParams.get("n") ?? "").split(",").map((s) => Number(s.trim())).filter((n) => Number.isInteger(n) && n > 0))].slice(0, MAX_FICHES);
  if (!numbers.length) return new Response("Aucune fiche demandée.", { status: 400 });

  const entries: ZipEntry[] = [];
  const missing: string[] = [];
  for (const n of numbers) {
    const detail = await fetchChoganDetail(n).catch(() => null);
    if (!detail) {
      missing.push(`Fiche ${n} : introuvable chez Chogan.`);
      continue;
    }
    const label = detail.shade ?? detail.name;
    for (const [i, url] of detail.images.slice(0, 8).entries()) {
      try {
        const { data } = await fetchChoganImage(url);
        entries.push({ name: photoFileName(detail.code, label, i, url), data });
      } catch {
        missing.push(`${detail.code} photo ${i + 1} : non téléchargée.`);
      }
    }
  }
  if (missing.length) entries.push({ name: "A-LIRE-photos-manquantes.txt", data: new TextEncoder().encode(missing.join("\r\n")) });
  if (!entries.length) return new Response("Aucune photo n'a pu être récupérée.", { status: 502 });

  const day = new Date().toISOString().slice(0, 10);
  return new Response(Buffer.from(createZip(entries)), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="photos-chogan-${day}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
