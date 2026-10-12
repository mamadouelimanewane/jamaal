/**
 * Réduction d'une photo dans le navigateur avant envoi : côté le plus long ramené à 1600 px,
 * JPEG qualité 0,85, fond blanc (les PNG transparents restent propres). Une photo de téléphone de
 * 4 à 6 Mo passe ainsi sous 1 Mo. Si le navigateur ne sait pas lire le fichier (HEIC sur un
 * ordinateur, par ex.), on renvoie l'original : le serveur dira s'il est acceptable.
 */
const MAX_SIDE = 1600;
const QUALITY = 0.85;

export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.type === "image/svg+xml") return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  // Déjà petite et déjà en JPEG : rien à gagner.
  if (scale === 1 && file.type === "image/jpeg" && file.size < 900 * 1024) {
    bitmap.close();
    return file;
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
  if (!blob || blob.size >= file.size) return file;
  const name = file.name.replace(/\.[a-z0-9]+$/i, "") + ".jpg";
  return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() });
}
