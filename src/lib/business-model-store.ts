import { prisma } from "./prisma";
import { normalizeBusinessModel, type BusinessModel } from "./business-model";

const KEY = "business_model";

/** Modèle économique en vigueur (valeurs par défaut si rien n'est encore enregistré). */
export async function getBusinessModel(): Promise<BusinessModel> {
  const row = await prisma.setting.findUnique({ where: { key: KEY } });
  if (!row) return normalizeBusinessModel(null);
  try {
    return normalizeBusinessModel(JSON.parse(row.value));
  } catch {
    return normalizeBusinessModel(null);
  }
}

export async function saveBusinessModel(model: BusinessModel) {
  const value = JSON.stringify(normalizeBusinessModel(model));
  await prisma.setting.upsert({ where: { key: KEY }, update: { value }, create: { key: KEY, value } });
}
