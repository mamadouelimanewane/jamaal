/**
 * Visuels du Skin Advisor (photos générées par l'IA ou photos libres de droits envoyées par l'admin).
 * Table Setting, clé « skin_visuals » : liste d'adresses publiques. Fichier serveur.
 */
import { prisma } from "@/lib/prisma";

const KEY = "skin_visuals";
export const MAX_VISUALS = 6;

export async function getSkinVisuals(): Promise<string[]> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: KEY } });
    const list = row ? (JSON.parse(row.value) as unknown) : [];
    return Array.isArray(list) ? list.filter((u): u is string => typeof u === "string" && /^https:\/\//.test(u)).slice(0, MAX_VISUALS) : [];
  } catch {
    return [];
  }
}

export async function setSkinVisuals(list: string[]) {
  const value = JSON.stringify([...new Set(list)].slice(0, MAX_VISUALS));
  await prisma.setting.upsert({ where: { key: KEY }, create: { key: KEY, value }, update: { value } });
}

/** Consignes de génération : femmes africaines, peaux foncées, lumière naturelle, aucun logo de marque. */
export const VISUAL_PROMPTS: { id: string; label: string; prompt: string }[] = [
  {
    id: "portrait",
    label: "Portrait éclatant",
    prompt:
      "Photorealistic beauty editorial portrait of a young Senegalese woman with deep dark brown skin, natural glowing healthy skin texture with visible pores, short natural coily hair, soft warm natural daylight from a window, beige minimalist background, gentle confident smile, looking at camera, no makeup look, high-end skincare campaign, 4:5 vertical, no text, no logo, no brand names.",
  },
  {
    id: "trio",
    label: "Trois femmes africaines",
    prompt:
      "Photorealistic skincare campaign photo of three African women of different ages (20s, 30s, 50s) with deep and medium dark brown skin tones, radiant natural skin, standing close together, elegant neutral clothing in sand and olive tones, warm sunlight with soft shadows on a cream wall, each holding a plain unbranded cosmetic jar or serum bottle, 4:5 vertical, no text, no logo, no readable labels.",
  },
  {
    id: "selfie",
    label: "Selfie analyse de peau",
    prompt:
      "Photorealistic close-up of a beautiful West African woman with very dark skin taking a selfie with a smartphone, subtle soft glowing grid lines of light gently mapping her cheek and forehead like a skin analysis, warm golden ambient light, calm expression, premium beauty-tech mood, 4:5 vertical, no text, no logo.",
  },
  {
    id: "routine",
    label: "Routine du soir",
    prompt:
      "Photorealistic image of a Black African woman with dark skin applying face cream in a bright modern bathroom in Dakar, wearing a cream headwrap, morning light, healthy hydrated skin, minimalist unbranded skincare bottles on the shelf, 4:5 vertical, no text, no logo, no readable labels.",
  },
];
