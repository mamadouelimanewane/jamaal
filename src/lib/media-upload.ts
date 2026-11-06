"use client";

import { upload } from "@vercel/blob/client";
import { compressImage } from "@/lib/image-compress";
import { isImageFile, isPdfFile, isVideoFile, mediaPath, videoContentType, videoFileError, MAX_IMAGE_BYTES, type MediaScope } from "@/lib/media";

/**
 * Envoie une photo ou une vidéo choisie dans la galerie, directement vers le stockage du site.
 * Les photos sont d'abord réduites ; les vidéos partent telles quelles (100 Mo au plus), avec la progression.
 * Renvoie l'adresse publique du fichier.
 */
export async function uploadMedia(file: File, scope: MediaScope, onProgress?: (percent: number) => void): Promise<string> {
  let body: File | Blob = file;
  let contentType: string;
  let name = file.name || "media";
  if (scope === "tarifs") {
    if (!isPdfFile(file)) throw new Error("Choisissez un fichier PDF.");
    if (file.size > 40 * 1024 * 1024) throw new Error("PDF trop lourd : 40 Mo au plus.");
    contentType = "application/pdf";
    if (!/\.pdf$/i.test(name)) name += ".pdf";
  } else if (isVideoFile(file)) {
    const err = videoFileError(file);
    if (err) throw new Error(err);
    contentType = videoContentType(file);
    if (!/\.[a-z0-9]{2,5}$/i.test(name)) name += contentType === "video/webm" ? ".webm" : contentType === "video/quicktime" ? ".mov" : ".mp4";
  } else if (isImageFile(file)) {
    if (file.size > MAX_IMAGE_BYTES * 3) throw new Error("Photo trop lourde.");
    body = await compressImage(file);
    contentType = body.type || "image/jpeg";
    if (body.size > MAX_IMAGE_BYTES) throw new Error("Photo trop lourde (10 Mo au plus).");
    name = name.replace(/\.[a-z0-9]{2,5}$/i, "") + (contentType === "image/png" ? ".png" : contentType === "image/webp" ? ".webp" : ".jpg");
  } else {
    throw new Error("Seules les photos et les vidéos sont acceptées.");
  }
  try {
    const res = await upload(mediaPath(scope, name, Date.now()), body, {
      access: "public",
      handleUploadUrl: "/api/media/upload",
      clientPayload: scope,
      contentType,
      multipart: body.size > 8 * 1024 * 1024,
      onUploadProgress: onProgress ? (p) => onProgress(Math.round(p.percentage)) : undefined,
    });
    return res.url;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    throw new Error(/refus|Accès|Réservé|Stockage|trop|format/i.test(msg) ? msg.replace(/^Vercel Blob: /, "") : "Envoi impossible : vérifiez la connexion et réessayez.");
  }
}
