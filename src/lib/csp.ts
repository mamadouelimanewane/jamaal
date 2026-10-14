/**
 * Politique de sécurité du contenu (CSP) avec nonce : seuls les scripts portant le nonce de la
 * requête (ceux de Next.js) s'exécutent ; un script injecté par un attaquant est bloqué.
 * Les styles restent en `unsafe-inline` (attributs style de React, risque faible).
 */
export function buildCsp(nonce: string, isDev = false): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https:",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

export const newNonce = () => Buffer.from(crypto.randomUUID()).toString("base64");
