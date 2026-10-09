import { put } from "@vercel/blob";
import { requireAdminForApi } from "@/lib/api-guard";

const TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX = 4 * 1024 * 1024;

/** Envoi d'un visuel du carrousel d'accueil (4 Mo au plus) ; renvoie son adresse publique. */
export async function POST(req: Request) {
  const forbidden = await requireAdminForApi();
  if (forbidden) return forbidden;
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0) return Response.json({ error: "Aucune image reçue." }, { status: 400 });
  if (!TYPES.includes(file.type)) return Response.json({ error: "Format accepté : JPG, PNG, WebP ou AVIF." }, { status: 400 });
  if (file.size > MAX) return Response.json({ error: "Image trop lourde (4 Mo au plus)." }, { status: 400 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return Response.json({ error: "Stockage d'images non configuré (BLOB_READ_WRITE_TOKEN)." }, { status: 500 });
  try {
    const safe = file.name.replace(/[^\w.-]+/g, "-").slice(-60);
    const blob = await put(`accueil/${Date.now()}-${safe}`, file, { access: "public", addRandomSuffix: true, contentType: file.type });
    return Response.json({ url: blob.url });
  } catch {
    return Response.json({ error: "Envoi impossible, réessayez." }, { status: 500 });
  }
}
