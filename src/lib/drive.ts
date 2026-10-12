/**
 * Liens Google Drive collés par l'administrateur (« Partager › Copier le lien »). Pur.
 * Formats reconnus :
 *   https://drive.google.com/file/d/<id>/view?usp=sharing
 *   https://drive.google.com/open?id=<id>
 *   https://drive.google.com/uc?id=<id>&export=download
 *   https://docs.google.com/uc?id=<id>
 *   https://drive.usercontent.google.com/download?id=<id>
 * Un lien de dossier (drive.google.com/drive/folders/…) n'est pas une image : refusé.
 */
const ID = /^[A-Za-z0-9_-]{20,120}$/;
const HOSTS = new Set(["drive.google.com", "docs.google.com", "drive.usercontent.google.com"]);

export function driveFileId(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || !HOSTS.has(u.hostname)) return null;
  if (/\/folders\//.test(u.pathname)) return null;
  const fromPath = u.pathname.match(/\/(?:file\/)?d\/([A-Za-z0-9_-]+)/)?.[1];
  const id = fromPath ?? u.searchParams.get("id");
  return id && ID.test(id) ? id : null;
}

export const isDriveFolderLink = (raw: string) => /drive\.google\.com\/drive\/(u\/\d+\/)?folders\//.test(raw);

/** Adresse de téléchargement direct d'un fichier partagé « Tous les utilisateurs disposant du lien ». */
export const driveDownloadUrl = (id: string) => `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`;
