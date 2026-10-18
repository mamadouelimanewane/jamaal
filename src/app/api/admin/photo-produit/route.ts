import { put } from "@vercel/blob";
import { requireAdminForApi } from "@/lib/api-guard";
import { driveDownloadUrl, driveFileId, isDriveFolderLink } from "@/lib/drive";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_UPLOAD = 4 * 1024 * 1024;
const MAX_DRIVE = 10 * 1024 * 1024;
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" };

const fail = (error: string, status = 400) => Response.json({ error }, { status });

async function store(data: Blob | Buffer, contentType: string, hint: string) {
  const safe = hint.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.-]+/g, "-").replace(/\.[a-z0-9]+$/i, "").slice(-50) || "photo";
  const blob = await put(`produits/${Date.now()}-${safe}.${EXT[contentType] ?? "jpg"}`, data, { access: "public", addRandomSuffix: true, contentType });
  return blob.url;
}

/**
 * Photo de fiche produit, envoyée une à une par le formulaire produit (Admin › Produits) :
 * - fichier choisi sur l'ordinateur ou le téléphone (multipart, champ « file », 4 Mo au plus,
 *   déjà réduit dans le navigateur) ;
 * - ou lien Google Drive (JSON { driveUrl }) d'une image partagée « Tous les utilisateurs disposant
 *   du lien » : le serveur la télécharge.
 * La photo est copiée sur le stockage du site ; la réponse donne son adresse publique.
 */
export async function POST(req: Request) {
  const forbidden = await requireAdminForApi("catalogue", "write");
  if (forbidden) return forbidden;
  if (!process.env.BLOB_READ_WRITE_TOKEN) return fail("Stockage d'images non configuré (variable BLOB_READ_WRITE_TOKEN sur Vercel).", 500);

  const type = req.headers.get("content-type") ?? "";
  try {
    if (type.includes("application/json")) {
      const body = (await req.json().catch(() => null)) as { driveUrl?: unknown } | null;
      const link = String(body?.driveUrl ?? "").trim();
      if (isDriveFolderLink(link)) return fail("C'est un lien de dossier : ouvrez l'image dans Drive et copiez le lien de ce fichier.");
      const id = driveFileId(link);
      if (!id) return fail("Lien Google Drive non reconnu. Dans Drive : clic droit sur l'image › Partager › Copier le lien.");
      const res = await fetch(driveDownloadUrl(id), { redirect: "follow", cache: "no-store", signal: AbortSignal.timeout(20_000) }).catch(() => null);
      if (!res) return fail("Google Drive ne répond pas, réessayez.", 502);
      const ct = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
      if (!res.ok || ct.startsWith("text/html")) {
        return fail("Image Drive inaccessible : dans Drive, Partager › Accès général › « Tous les utilisateurs disposant du lien », puis recopiez le lien.");
      }
      if (!TYPES.includes(ct)) return fail("Ce fichier Drive n'est pas une image JPG, PNG, WebP ou AVIF.");
      const data = Buffer.from(await res.arrayBuffer());
      if (data.length > MAX_DRIVE) return fail("Image Drive trop lourde (10 Mo au plus).");
      const name = res.headers.get("content-disposition")?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)/i)?.[1] ?? `drive-${id.slice(0, 8)}`;
      return Response.json({ url: await store(data, ct, decodeURIComponent(name)) });
    }

    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File) || file.size === 0) return fail("Aucune image reçue.");
    if (!TYPES.includes(file.type)) return fail("Format accepté : JPG, PNG, WebP ou AVIF.");
    if (file.size > MAX_UPLOAD) return fail("Image trop lourde (4 Mo au plus).");
    return Response.json({ url: await store(file, file.type, file.name) });
  } catch {
    return fail("Envoi impossible, réessayez.", 500);
  }
}
