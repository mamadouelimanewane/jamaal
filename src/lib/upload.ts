import { put } from "@vercel/blob";

export async function uploadProductImage(file: File): Promise<string> {
  const blob = await put(`produits/${Date.now()}-${file.name}`, file, {
    access: "public",
    addRandomSuffix: true,
  });
  return blob.url;
}

export async function uploadMarketingAsset(file: File): Promise<string> {
  const blob = await put(`kit-marketing/${Date.now()}-${file.name}`, file, {
    access: "public",
    addRandomSuffix: true,
  });
  return blob.url;
}
