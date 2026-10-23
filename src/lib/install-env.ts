/**
 * Navigateur du téléphone, pour guider l'installation de l'application JAMAAL (pur, testé).
 * - ios-safari : Safari sur iPhone/iPad (Partager > Sur l'écran d'accueil)
 * - ios-other : autre navigateur iPhone (Chrome, Firefox…) : passer par Safari (ou « Partager » sur iOS 16.4+)
 * - in-app : navigateur intégré de WhatsApp, Instagram, Facebook, TikTok : l'installation y est impossible
 * - android : Chrome / Samsung Internet sur Android (installation directe)
 * - desktop : ordinateur
 */
export type InstallEnv = "ios-safari" | "ios-other" | "in-app" | "android" | "desktop";

export function installEnv(ua: string, maxTouchPoints = 0, platform = ""): InstallEnv {
  const ios = /iphone|ipad|ipod/i.test(ua) || (platform === "MacIntel" && maxTouchPoints > 1);
  if (/FBAN|FBAV|FB_IAB|Instagram|WhatsApp|musical_ly|BytedanceWebview|TikTok|Snapchat|Line\//i.test(ua)) return "in-app";
  if (ios) return /CriOS|FxiOS|EdgiOS|OPiOS|GSA\//i.test(ua) ? "ios-other" : "ios-safari";
  if (/android/i.test(ua)) return /; wv\)/.test(ua) ? "in-app" : "android";
  return "desktop";
}

/** Page de suite après installation : uniquement une page de l'espace (/admin…), jamais une autre adresse. */
export function safeNext(raw: unknown): string {
  const s = typeof raw === "string" ? raw : "";
  return /^\/admin(\/[\w\-/?=&%.]*)?$/.test(s) && !s.startsWith("//") ? s : "/admin/login";
}
