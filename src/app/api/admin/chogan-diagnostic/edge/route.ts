/**
 * Même test d'accès au site Chogan, depuis le réseau « edge » de Vercel (autres adresses que
 * les fonctions serveur, que Cloudflare bloque). Ne renvoie que des codes HTTP : rien de sensible.
 */
export const runtime = "edge";
export const dynamic = "force-dynamic";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";
const URLS = [
  "https://www.chogangroupspa.com/chogangroup/productDetail/9479",
  "https://www.chogangroupspa.com/chogangroup/productList?search=MM061",
  "https://cdn.chogangroupspa.com/images/prodotti/big/PR17575882390MM041-PEACH.jpg",
];

export async function GET() {
  const out = [];
  for (const url of URLS) {
    const t = Date.now();
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html,image/*,*/*;q=0.8", "Accept-Language": "fr-FR,fr;q=0.9", Cookie: "language_id=13" }, cache: "no-store" });
      const text = res.headers.get("content-type")?.includes("text") ? await res.text() : "";
      out.push({ url: url.slice(8, 70), statut: res.status, ms: Date.now() - t, cfRay: res.headers.get("cf-ray"), titre: text.match(/<title>(.*?)<\/title>/i)?.[1]?.trim().slice(0, 100) ?? null, fiche: /id="id_art"/.test(text) });
    } catch (e) {
      out.push({ url, erreur: String(e) });
    }
  }
  return Response.json({ runtime: "edge", resultats: out });
}
