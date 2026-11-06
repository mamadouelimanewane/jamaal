import { prisma } from "@/lib/prisma";

/** Liste de prix PDF des revendeurs (page Produits de l'espace revendeur). */
export type PriceList = { url: string; title: string; updatedAt: string };

const KEY = "reseller_price_list";

/** Liste livrée avec le site, tant qu'aucune autre n'a été envoyée depuis le back-office. */
export const DEFAULT_PRICE_LIST: PriceList = {
  url: "/catalogue/liste-de-prix-jamaal-octobre-2026.pdf",
  title: "Liste de prix JAMAAL — octobre 2026",
  updatedAt: "2026-11-06",
};

export const PDF_MAX_BYTES = 40 * 1024 * 1024;

export function parsePriceList(raw: string | null | undefined): PriceList | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<PriceList>;
    if (typeof v.url !== "string" || !(/^https:\/\/\S+\.pdf$/i.test(v.url) || /^\/catalogue\/[\w-]+\.pdf$/.test(v.url))) return null;
    return { url: v.url, title: String(v.title || "Liste de prix JAMAAL").slice(0, 120), updatedAt: String(v.updatedAt || "") };
  } catch {
    return null;
  }
}

export async function getPriceList(): Promise<PriceList> {
  const row = await prisma.setting.findUnique({ where: { key: KEY } }).catch(() => null);
  return parsePriceList(row?.value) ?? DEFAULT_PRICE_LIST;
}

export async function savePriceList(list: PriceList): Promise<void> {
  const value = JSON.stringify(list);
  await prisma.setting.upsert({ where: { key: KEY }, update: { value }, create: { key: KEY, value } });
}
