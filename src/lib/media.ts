/**
 * Photos et vidéos envoyées depuis la galerie du téléphone ou de l'ordinateur (fiches produits, kit
 * marketing, boutique du revendeur, carrousel d'accueil). Règles communes, pures (navigateur et serveur).
 */
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;
export const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"] as const;
/** Vidéo : 100 Mo au plus (environ 1 à 2 minutes filmées au téléphone). */
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
/** Image : 10 Mo au plus avant réduction dans le navigateur. */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** Galerie de la boutique du revendeur : nombre de photos et vidéos au plus. */
export const SHOP_MEDIA_MAX = 12;

/** Où chaque espace range ses fichiers (début du chemin sur le stockage). */
export const MEDIA_SCOPES = {
  produit: "produits",
  accueil: "accueil",
  kit: "kit-marketing",
  boutique: "boutiques",
} as const;
export type MediaScope = keyof typeof MEDIA_SCOPES;

export const isMediaScope = (s: unknown): s is MediaScope => typeof s === "string" && Object.hasOwn(MEDIA_SCOPES, s);

const VIDEO_EXT = /\.(mp4|m4v|mov|webm)$/i;

/** Adresse d'une vidéo (d'après l'extension du fichier). */
export function isVideoUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const path = url.split(/[?#]/)[0];
  return VIDEO_EXT.test(path);
}

/** Fichier vidéo choisi dans la galerie (type, ou extension quand le téléphone ne donne pas le type). */
export function isVideoFile(f: { type: string; name: string }): boolean {
  return f.type.startsWith("video/") || VIDEO_EXT.test(f.name);
}

export function isImageFile(f: { type: string; name: string }): boolean {
  return f.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|heic|heif|avif)$/i.test(f.name);
}

/** Type de contenu d'une vidéo, déduit de l'extension si le téléphone ne le donne pas. */
export function videoContentType(f: { type: string; name: string }): string {
  if ((VIDEO_TYPES as readonly string[]).includes(f.type)) return f.type;
  if (/\.webm$/i.test(f.name)) return "video/webm";
  if (/\.mov$/i.test(f.name)) return "video/quicktime";
  return "video/mp4";
}

/** Contrôle d'une vidéo avant envoi ; renvoie un message d'erreur, ou null si elle est acceptée. */
export function videoFileError(f: { type: string; name: string; size: number }): string | null {
  if (!isVideoFile(f)) return "Ce fichier n'est pas une vidéo.";
  if (f.type && f.type.startsWith("video/") && !(VIDEO_TYPES as readonly string[]).includes(f.type)) return "Format vidéo accepté : MP4, MOV (iPhone) ou WebM.";
  if (f.size > MAX_VIDEO_BYTES) return `Vidéo trop lourde (${Math.round(f.size / 1024 / 1024)} Mo) : 100 Mo au plus. Raccourcissez-la dans la galerie du téléphone.`;
  if (f.size === 0) return "Vidéo vide.";
  return null;
}

/** Chemin de rangement d'un fichier : <dossier de l'espace>/<horodatage>-<nom nettoyé>.<ext>. */
export function mediaPath(scope: MediaScope, name: string, now: number): string {
  const ext = (name.match(/\.([a-z0-9]{2,5})$/i)?.[1] ?? "bin").toLowerCase();
  const base = name
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(-40) || "media";
  return `${MEDIA_SCOPES[scope]}/${now}-${base}.${ext}`;
}

/** Le chemin demandé est bien rangé dans le dossier de l'espace (et sans remontée). */
export function pathFitsScope(pathname: string, scope: MediaScope): boolean {
  return pathname.startsWith(`${MEDIA_SCOPES[scope]}/`) && !pathname.includes("..") && /^[\w\-./]+$/.test(pathname) && pathname.length <= 200;
}

/** Liste de photos/vidéos envoyée par un formulaire (JSON) : adresses https ou chemins du site, sans doublon. */
export function parseMediaList(raw: FormDataEntryValue | null, max: number): string[] {
  if (raw === null) return [];
  let list: unknown;
  try {
    list = JSON.parse(String(raw) || "[]");
  } catch {
    throw new Error("Liste de photos et vidéos illisible.");
  }
  if (!Array.isArray(list)) throw new Error("Liste de photos et vidéos illisible.");
  const clean = [...new Set(list.map((x) => String(x ?? "").trim()).filter(Boolean))];
  const bad = clean.find((u) => !(/^https:\/\/[^\s]{4,1000}$/.test(u) || /^\/[\w\-./%]+$/.test(u)) || u.includes(".."));
  if (bad) throw new Error(`Adresse refusée : ${bad.slice(0, 80)}`);
  if (clean.length > max) throw new Error(`${max} photos ou vidéos au plus.`);
  return clean;
}
