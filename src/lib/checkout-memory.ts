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

const digits = (s: string) => s.replace(/\D/g, "").slice(-9);

/** Efface l'identité mémorisée (« ce n'est pas moi »). */
export function forgetCheckoutMemory() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // sans conséquence
  }
}

/**
 * Mémorise nom et téléphone pour le prochain achat. Si une identité est déjà mémorisée avec un autre numéro, on la
 * garde : le client a sans doute commandé pour quelqu'un d'autre. Il peut l'effacer pour mémoriser la nouvelle.
 */
export function saveCheckoutMemory(v: { name: string; phone: string }) {
  const existing = loadCheckoutMemory();
  if (existing && existing.phone && digits(existing.phone) !== digits(v.phone)) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ name: v.name.trim(), phone: v.phone.trim() }));
  } catch {
    // stockage indisponible (navigation privée) : sans conséquence
  }
}
