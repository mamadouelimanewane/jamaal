/**
 * search-ai.ts
 * Expansion de requête par l'IA (Google Gemini Flash) : quand la recherche classique donne peu
 * ou pas de résultats, l'IA analyse la phrase en langage naturel pour en extraire les bons mots-clés.
 */
import { generateContent, geminiConfigured, textOf } from "./ai/gemini";

type Expansion = {
  keywords: string[];    // Mots-clés optimisés pour la recherche (noms propres, codes, marques)
  corrected: string;     // Requête reformulée en clair
  confident: boolean;    // L'IA est-elle sûre de l'interprétation ?
};

const SYSTEM_PROMPT = `Tu es un assistant expert des produits Chogan, une marque de cosmétiques et parfums italiens.
Chogan fabrique des parfums inspirés des grandes maisons (Dior, Chanel, Armani...), des soins corps et cheveux, des produits ménagers.
Ton rôle est d'analyser une requête utilisateur en langage naturel et d'extraire les mots-clés pertinents pour une recherche dans un catalogue de produits. Comprends les demandes en français et en wolof sénégalais (y compris les formulations transcrites sans accents) et réponds avec des mots-clés français présents dans le catalogue.

Réponds TOUJOURS avec ce JSON exact :
{
  "keywords": ["mot1", "mot2", ...],
  "corrected": "requête reformulée",
  "confident": true/false
}

Exemples :
- "quelque chose qui sent le soir élégant pour femme" → keywords: ["femme", "soir", "elegant", "floral"], corrected: "parfum femme soir élégant"
- "alternative pas chère à Dior Sauvage" → keywords: ["sauvage", "dior", "homme"], corrected: "parfum inspiré Sauvage Dior"
- "crème hydratante pour les mains à l'argan" → keywords: ["crème", "mains", "argan"], corrected: "crème mains argan"
- "j'aime Coco Mademoiselle" → keywords: ["coco", "mademoiselle", "chanel", "femme"], corrected: "parfum inspiré Coco Mademoiselle Chanel"
- "parfum oriental boisé unisexe" → keywords: ["oriental", "boisé", "unisexe", "oud"], corrected: "parfum oriental boisé unisexe"
`;

// Cache simple en mémoire pour éviter les appels API répétés sur la même requête (500 entrées max)
const expandCache = new Map<string, Expansion>();

export async function expandQueryWithAI(query: string): Promise<Expansion | null> {
  if (!geminiConfigured()) return null;

  const cacheKey = query.toLowerCase().trim();
  if (expandCache.has(cacheKey)) return expandCache.get(cacheKey)!;

  try {
    const content = await generateContent({
      system: SYSTEM_PROMPT,
      contents: [{ role: "user", parts: [{ text: `Requête : "${query.slice(0, 80)}"` }] }],
      temperature: 0.2,
      maxOutputTokens: 1024,
      json: true,
      thinking: "minimal",
      timeoutMs: 7000,
    });
    const parsed = JSON.parse(textOf(content)) as Expansion;
    if (!Array.isArray(parsed.keywords) || !parsed.keywords.length) return null;
    parsed.keywords = parsed.keywords.filter((k) => typeof k === "string").slice(0, 8);

    if (expandCache.size > 500) expandCache.clear();
    expandCache.set(cacheKey, parsed);
    return parsed;
  } catch (e) {
    // La recherche classique reste affichée ; l'erreur est journalisée pour être visible.
    console.error("[search-ai]", e instanceof Error ? e.message : e);
    return null;
  }
}
