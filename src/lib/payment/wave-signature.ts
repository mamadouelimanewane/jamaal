/**
 * Signature des webhooks Wave (en-tête Wave-Signature). Pur, testé.
 * Format Wave : « t=<horodatage>,v1=<hex>[,v1=<hex>…] », signature HMAC-SHA256 de `${t}${corps brut}`
 * avec le secret du webhook (plusieurs v1 possibles pendant un changement de secret).
 * Format simple accepté aussi : « <hex> » = HMAC-SHA256 du corps brut.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_AGE_SEC = 5 * 60;

export function verifyWaveSignature(raw: string, header: string, secret: string, nowSec = Math.floor(Date.now() / 1000)): boolean {
  if (!header || !secret) return false;
  const candidates: { sig: string; payload: string }[] = [];
  if (header.includes("v1=")) {
    const parts = header.split(",").map((p) => p.trim());
    const t = parts.find((p) => p.startsWith("t="))?.slice(2);
    if (!t || !/^\d+$/.test(t)) return false;
    // Rejeu : un message trop ancien (ou trop en avance) est refusé.
    if (Math.abs(nowSec - Number(t)) > MAX_AGE_SEC) return false;
    for (const p of parts) if (p.startsWith("v1=")) candidates.push({ sig: p.slice(3), payload: `${t}${raw}` });
  } else {
    candidates.push({ sig: header.trim(), payload: raw });
  }
  return candidates.some(({ sig, payload }) => {
    const expected = createHmac("sha256", secret).update(payload).digest("hex");
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  });
}
