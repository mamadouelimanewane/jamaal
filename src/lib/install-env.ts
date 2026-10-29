/**
 * Navigateur du téléphone, pour guider l'installation de l'application JAMAAL (pur, testé).
 * - ios-safari : Safari sur iPhone/iPad (Partager > Sur l'écran d'accueil)
 * - ios-other : autre navigateur iPhone (Chrome, Firefox…) : passer par Safari (ou « Partager » sur iOS 16.4+)
 * - in-app : navigateur intégré de WhatsApp, Instagram, Facebook, TikTok : l'installation y est impossible
 * - android : Chrome sur Android (installation directe)
 * - android-samsung : Samsung Internet (menu ≡ en bas › « Ajouter la page à » › Écran d'accueil)
 * - android-other : autre navigateur Android (Firefox, Opera, Xiaomi…) : passer par Chrome
 * - desktop : ordinateur
 */
export type InstallEnv = "ios-safari" | "ios-other" | "in-app" | "android" | "android-samsung" | "android-other" | "desktop";

export function installEnv(ua: string, maxTouchPoints = 0, platform = ""): InstallEnv {
  const ios = /iphone|ipad|ipod/i.test(ua) || (platform === "MacIntel" && maxTouchPoints > 1);
  if (/FBAN|FBAV|FB_IAB|Instagram|WhatsApp|musical_ly|BytedanceWebview|TikTok|Snapchat|Line\//i.test(ua)) return "in-app";
  if (ios) return /CriOS|FxiOS|EdgiOS|OPiOS|GSA\//i.test(ua) ? "ios-other" : "ios-safari";
  if (/android/i.test(ua)) {
    if (/; wv\)/.test(ua)) return "in-app";
    if (/SamsungBrowser/i.test(ua)) return "android-samsung";
    if (/Firefox|FxiOS|OPR\/|Opera|MiuiBrowser|XiaoMi|EdgA|YaBrowser|UCBrowser|HeyTapBrowser|VivoBrowser|Silk/i.test(ua) || !/Chrome\//.test(ua)) return "android-other";
    return "android";
  }
  return "desktop";
}

/** Page de suite après installation : uniquement une page de l'espace (/admin…), jamais une autre adresse. */
export function safeNext(raw: unknown): string {
  const s = typeof raw === "string" ? raw : "";
  return /^\/admin(\/[\w\-/?=&%.]*)?$/.test(s) && !s.startsWith("//") ? s : "/admin/login";
}
