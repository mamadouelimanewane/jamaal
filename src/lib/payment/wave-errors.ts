/**
 * Erreurs de l'API Wave (création d'une session de paiement), expliquées en français. Pur, testé.
 * Wave répond { "code": "...", "message": "..." } avec un statut HTTP.
 */
export type WaveErrorInfo = { status: number; code: string; cause: string; fix: string };

export function explainWaveError(status: number, body: string): WaveErrorInfo {
  let code = "";
  let message = "";
  try {
    const j = JSON.parse(body) as { code?: string; message?: string; details?: unknown };
    code = String(j.code ?? "");
    message = String(j.message ?? "");
  } catch {
    message = body.slice(0, 160);
  }
  const c = `${code} ${message}`.toLowerCase();
  const out = (cause: string, fix: string): WaveErrorInfo => ({ status, code: code || String(status), cause, fix });
  if (/ip-not-allowed|not in allowlist|ip address/.test(c))
    return out("La clé API Wave n'accepte que certaines adresses IP (liste blanche), et les serveurs du site (Vercel) changent d'adresse.", "Dans Wave Business › Développeurs › Clés API, retirez la restriction d'adresse IP de la clé (ou créez une nouvelle clé « Checkout API » sans liste d'IP), mettez-la dans WAVE_API_KEY sur Vercel et redéployez.");
  if (status === 401 || /invalid-auth|missing-auth|revoked|invalid api key|unauthori[sz]ed/.test(c))
    return out("Wave ne reconnaît pas la clé API (clé erronée, incomplète ou révoquée).", "Dans Wave Business › Développeurs › Clés API, créez une nouvelle clé « Checkout API », copiez-la en entier (elle commence par wave_sn_prod_) et remplacez WAVE_API_KEY dans Vercel, puis redéployez.");
  if (status === 403 || /permission|not-authorized|forbidden|not allowed/.test(c))
    return out("La clé API n'a pas l'accès « Checkout » (ou le compte n'est pas encore autorisé à encaisser par API).", "Dans Wave Business › Développeurs, vérifiez que la clé a la permission « Checkout API ». Si le compte est récent, demandez à Wave l'activation de l'API marchande (validation du dossier).");
  if (status === 400 || /validation|invalid/.test(c))
    return out(`Wave a refusé les informations envoyées${message ? ` (${message})` : ""}.`, "Vérifiez que l'adresse du site est en https (NEXT_PUBLIC_SITE_URL) et que le montant est d'au moins 100 F. Envoyez ce message à l'équipe technique.");
  if (status === 429) return out("Trop de demandes envoyées à Wave.", "Réessayez dans une minute.");
  if (status >= 500) return out("Wave est momentanément indisponible.", "Réessayez dans quelques minutes.");
  return out(`Réponse inattendue de Wave (${status}${message ? ` : ${message}` : ""}).`, "Envoyez ce message à l'équipe technique.");
}
