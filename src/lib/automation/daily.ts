/**
 * Tâche quotidienne (cron Vercel, 19 h à Dakar) : chaque travail est indépendant (une erreur
 * n'arrête pas les suivants) et idempotent (relancer la tâche ne renvoie rien en double).
 * La veille des prix Chogan passe en dernier et utilise le temps restant.
 */
import { sendDailySummary } from "./summary";
import { runRelances } from "./relances";
import { requestReviews } from "./reviews";
import { awardChallenges } from "./challenges";
import { watchChoganPrices } from "./chogan-watch";

export async function runDailyJobs(origin: string, opts: { budgetMs?: number; now?: Date } = {}) {
  const started = Date.now();
  const budgetMs = opts.budgetMs ?? 50_000;
  const now = opts.now ?? new Date();
  const report: Record<string, unknown> = {};
  const step = async (name: string, fn: () => Promise<unknown>) => {
    try {
      report[name] = await fn();
    } catch (e) {
      console.error(`[tâche quotidienne] ${name}`, e);
      report[name] = { erreur: e instanceof Error ? e.message : String(e) };
    }
  };
  await step("defis", () => awardChallenges(now));
  await step("relances", () => runRelances(origin, now));
  await step("avis", () => requestReviews(origin, now));
  await step("veilleChogan", () => watchChoganPrices(Math.max(5_000, budgetMs - (Date.now() - started) - 8_000)));
  // Le résumé en dernier : il compte aussi les changements de prix détectés juste avant.
  await step("resume", () => sendDailySummary(origin, now).then((t) => (t.length > 60 ? "envoyé" : t)));
  report.dureeMs = Date.now() - started;
  return report;
}
