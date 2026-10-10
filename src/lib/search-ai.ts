/**
 * search-ai.ts
 * Module d'expansion de requête IA basé sur Google Gemini Flash (gratuit).
 * Quand la recherche classique donne peu ou pas de résultats,
 * l'IA analyse la phrase en langage naturel pour extraire les bons mots-clés.
 */

const GEMINI_API_KEY = process.env.GOOGLE_AI_API_KEY;
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

type Expansion = {
  keywords: string[];    // Mots-clés optimisés pour la recherche (noms propres, codes, marques)
  corrected: string;     // Requête reformulée en clair
  confident: boolean;    // L'IA est-elle sûre de l'interprétation ?
};

const SYSTEM_PROMPT = `Tu es un assistant expert des produits Chogan, une marque de cosmétiques et parfums italiens.
Chogan fabrique des parfums inspirés des grandes maisons (Dior, Chanel, Armani...), des soins corps et cheveux, des produits ménagers.
Ton rôle est d'analyser une requête utilisateur en langage naturel et d'extraire les mots-clés pertinents pour une recherche dans un catalogue de produits.

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

// Cache simple en mémoire pour éviter les appels API répétés sur la même requête
const expandCache = new Map<string, Expansion>();

export async function expandQueryWithAI(query: string): Promise<Expansion | null> {
  if (!GEMINI_API_KEY) return null;

  const cacheKey = query.toLowerCase().trim();
  if (expandCache.has(cacheKey)) return expandCache.get(cacheKey)!;

  try {
    const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ parts: [{ text: `Requête : "${query}"` }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 256,
          responseMimeType: "application/json"
        }
      }),
      signal: AbortSignal.timeout(4000) // 4 secondes max
    });

    if (!response.ok) return null;

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;

    const parsed: Expansion = JSON.parse(text);
    if (!parsed.keywords?.length) return null;

    // Mise en cache (5 minutes max, 500 entrées max)
    if (expandCache.size > 500) expandCache.clear();
    expandCache.set(cacheKey, parsed);

    return parsed;
  } catch {
    return null; // Silencieux en cas d'erreur réseau ou timeout
  }
}
