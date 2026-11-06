import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { auth } from "@/lib/auth";
import { requireAdminForApi } from "@/lib/api-guard";
import { IMAGE_TYPES, MAX_VIDEO_BYTES, PDF_TYPE, VIDEO_TYPES, isMediaScope, pathFitsScope, type MediaScope } from "@/lib/media";

export const dynamic = "force-dynamic";

/** Qui peut envoyer dans chaque espace. */
async function forbidden(scope: MediaScope): Promise<string | null> {
  if (scope === "boutique") {
    const session = await auth();
    return session?.user?.role === "CONSULTANT" ? null : "Réservé aux revendeurs connectés.";
  }
  const area = scope === "produit" ? "catalogue" : "marketing";
  return (await requireAdminForApi(area, "write")) ? "Accès refusé." : null;
}

/**
 * Envoi direct d'une photo ou d'une vidéo du navigateur vers le stockage (sans passer par le serveur, qui
 * limite la taille des envois) : le serveur vérifie le droit d'envoyer, puis délivre une autorisation à
 * usage unique limitée au dossier de l'espace, aux formats image et vidéo et à 100 Mo.
 */
export async function POST(req: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return Response.json({ error: "Stockage non configuré (BLOB_READ_WRITE_TOKEN sur Vercel)." }, { status: 500 });
  const body = (await req.json().catch(() => null)) as HandleUploadBody | null;
  if (!body) return Response.json({ error: "Demande illisible." }, { status: 400 });
  try {
    const json = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const scope = clientPayload ?? "";
        if (!isMediaScope(scope)) throw new Error("Espace inconnu.");
        const denied = await forbidden(scope);
        if (denied) throw new Error(denied);
        if (!pathFitsScope(pathname, scope)) throw new Error("Nom de fichier refusé.");
        return {
          allowedContentTypes: scope === "tarifs" ? [PDF_TYPE] : [...IMAGE_TYPES, ...VIDEO_TYPES],
          maximumSizeInBytes: MAX_VIDEO_BYTES,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {},
    });
    return Response.json(json);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Envoi refusé." }, { status: 400 });
  }
}
