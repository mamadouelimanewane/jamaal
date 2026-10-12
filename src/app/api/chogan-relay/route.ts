import { RELAY_HEADER, allowedChoganUrl, relaySecret, relayToken } from "@/lib/chogan/relay";

/** Relais edge vers le site Chogan (voir src/lib/chogan/relay.ts). Réservé au serveur JAMAAL. */
export const runtime = "edge";
export const dynamic = "force-dynamic";
/**
 * En Europe : Cloudflare laisse passer le réseau edge européen (test depuis Paris : 200) mais
 * bloque les appels qui sortent des États-Unis (région des fonctions serveur, iad1).
 */
export const preferredRegion = ["fra1", "cdg1", "arn1"];

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";

export async function GET(req: Request) {
  const secret = relaySecret();
  if (!secret || req.headers.get(RELAY_HEADER) !== (await relayToken(secret))) return new Response("Accès refusé.", { status: 401 });
  const target = allowedChoganUrl(new URL(req.url).searchParams.get("u"));
  if (!target) return new Response("Adresse refusée.", { status: 400 });
  const isImage = target.hostname.startsWith("cdn.");
  try {
    const res = await fetch(target, {
      headers: {
        "User-Agent": UA,
        Accept: isImage ? "image/avif,image/webp,image/*,*/*;q=0.8" : "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8,it;q=0.7",
        Cookie: "language_id=13",
        ...(isImage ? { Referer: "https://www.chogangroupspa.com/" } : {}),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    return new Response(res.body, {
      status: res.status,
      headers: { "content-type": res.headers.get("content-type") ?? "application/octet-stream", "cache-control": "no-store", "x-chogan-status": String(res.status), "x-relay-region": process.env.VERCEL_REGION ?? "" },
    });
  } catch {
    return new Response("Site Chogan injoignable.", { status: 504 });
  }
}
