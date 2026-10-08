/**
 * Cache « versionné » de l'index de recherche : avant de servir l'index, on lit une
 * empreinte très légère de la base (dernière modification, nombre de produits…). Si elle a
 * changé, l'index est reconstruit : un produit ajouté, modifié ou supprimé est cherchable
 * dès la recherche suivante, sur toutes les instances du serveur.
 */
export interface VersionedCacheOptions<T> {
  load: () => Promise<T>;
  version: () => Promise<string>;
  /** Intervalle minimal entre deux lectures de l'empreinte (rafale de frappes). */
  checkEveryMs?: number;
  now?: () => number;
}

export function createVersionedCache<T>(opts: VersionedCacheOptions<T>) {
  const now = opts.now ?? Date.now;
  const every = opts.checkEveryMs ?? 1000;
  let value: T | null = null;
  let ver: string | null = null;
  let checkedAt = -Infinity;
  let inflight: Promise<T> | null = null;
  let builds = 0;

  async function refresh(): Promise<T> {
    const v = await opts.version();
    checkedAt = now();
    if (value !== null && v === ver) return value;
    const next = await opts.load();
    builds += 1;
    value = next;
    ver = v;
    return next;
  }

  return {
    async get(): Promise<T> {
      if (value !== null && now() - checkedAt < every) return value;
      inflight ??= refresh().finally(() => {
        inflight = null;
      });
      return inflight;
    },
    /** Force une vérification à la prochaine lecture (après une modification sur cette instance). */
    invalidate() {
      ver = null;
      checkedAt = -Infinity;
    },
    stats: () => ({ builds, version: ver }),
  };
}
