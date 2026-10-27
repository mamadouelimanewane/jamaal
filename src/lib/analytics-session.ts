const KEY = "jamaal_analytics_session";

/** Identifiant temporaire au niveau de l'onglet, sans donnée personnelle. */
export function getAnalyticsSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = window.sessionStorage.getItem(KEY);
  if (!id) {
    id = typeof window.crypto?.randomUUID === "function"
      ? window.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    window.sessionStorage.setItem(KEY, id);
  }
  return id;
}
