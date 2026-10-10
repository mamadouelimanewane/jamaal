/** Contexte commun des pages de comptabilité : garde admin, grand livre, période. Fichier serveur. */
import { requireAdminPage } from "../admin-page-guard";
import { loadLedger } from "./ledger";
import { parsePeriod } from "./period";

export type SP = Promise<Record<string, string | string[] | undefined>>;

export async function accountingContext(searchParams: SP, defaultPreset = "mois") {
  await requireAdminPage();
  const [sp, L] = await Promise.all([searchParams, loadLedger()]);
  const period = parsePeriod(sp, new Date(), L.start, defaultPreset);
  const query = period.preset === "perso" ? `du=${period.fromStr}&au=${period.toStr}` : `p=${period.preset}`;
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  return { L, period, query, sp, get };
}
