/** Réduit une photo (1600 px au plus, JPEG) pour un envoi rapide, même en 3G. À appeler dans le navigateur. */
export async function compressPhoto(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.82));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

/** Réduit un logo (800 px au plus) en gardant sa transparence (PNG, WebP) ; JPEG reste JPEG. Navigateur. */
export async function compressLogo(file: File): Promise<File> {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 800 / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 400_000) return file;
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    const type = file.type === "image/jpeg" ? "image/jpeg" : "image/png";
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, type, 0.9));
    return blob && blob.size < file.size ? new File([blob], type === "image/png" ? "logo.png" : "logo.jpg", { type }) : file;
  } catch {
    return file;
  }
}
