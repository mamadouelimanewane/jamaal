/** Nom et téléphone du dernier achat, gardés sur l'appareil pour pré-remplir le formulaire (jamais envoyés ailleurs). */
const KEY = "jamaal_checkout";

export function loadCheckoutMemory(): { name: string; phone: string } | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { name?: unknown; phone?: unknown };
    const name = typeof v.name === "string" ? v.name.slice(0, 120) : "";
    const phone = typeof v.phone === "string" ? v.phone.slice(0, 30) : "";
    return name || phone ? { name, phone } : null;
  } catch {
    return null;
  }
}

export function saveCheckoutMemory(v: { name: string; phone: string }) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ name: v.name.trim(), phone: v.phone.trim() }));
  } catch {
    // stockage indisponible (navigation privée) : sans conséquence
  }
}
