/**
 * Tâche quotidienne (cron Vercel, 19 h à Dakar) : chaque travail est indépendant (une erreur
 * n'arrête pas les suivants) et idempotent (relancer la tâche ne renvoie rien en double).
 * La veille des prix Chogan passe en dernier et utilise le temps restant.
 */
import { sendDailySummary } from "./summary";
import { retryPendingWithdrawals } from "@/lib/wallet";
import { runSubscriptions } from "@/lib/subscriptions/run";
import { weeklyForecastAlert } from "@/lib/forecast/run";
import { alertManagers } from "@/lib/health/run";
import { scanMembers } from "@/lib/fraud/run";
import { fraudControlEnabled } from "@/lib/fraud/settings";
import { runRelances } from "./relances";
import { requestReviews } from "./reviews";
import { awardChallenges } from "./challenges";
import { watchChoganPrices } from "./chogan-watch";
import { sweepMissedCommissions } from "@/lib/payouts/engine";
import { creditLivreurEarnings } from "@/lib/wallet";
import { alertChallengesAlmostDone } from "@/lib/whatsapp/alerts";
import { whatsappConfig } from "@/lib/whatsapp";
import { runInstallmentReminders, runUnpaidPaymentLinks } from "@/lib/installments-notify";

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
  // Commissions et parts de livraison : rattrape tout ce qui n'aurait pas été crédité dans les wallets JAMAAL.
  // Contrôle anti-fraude des membres d'abord : un membre signalé voit ses nouvelles commissions mises en vérification.
  await step("fraude", async () => ((await fraudControlEnabled()) ? scanMembers(now) : "suspendu"));
  await step("commissions", async () => ({ ...(await sweepMissedCommissions(now)), livraisonsCreditees: await creditLivreurEarnings() }));
  // Retraits des membres : renvoi des demandes en attente et relecture des versements Wave en cours.
  await step("retraits", () => retryPendingWithdrawals());
  await step("defis", () => awardChallenges(now));
  if (whatsappConfig().active) await step("defis80", () => alertChallengesAlmostDone(now));
  await step("relances", () => runRelances(origin, now));
  await step("echeances", () => runInstallmentReminders(now));
  await step("liensImpayes", () => runUnpaidPaymentLinks(now));
  await step("abonnements", () => runSubscriptions(origin, now));
  await step("prevision", () => weeklyForecastAlert(origin, now));
  // Lundi : chaque Leader et parrain reçoit la liste de ses membres qui décrochent.
  if (now.getUTCDay() === 1) await step("santeReseau", () => alertManagers(origin, now));
  await step("avis", () => requestReviews(origin, now));
  await step("veilleChogan", () => watchChoganPrices(Math.max(5_000, budgetMs - (Date.now() - started) - 8_000)));
  // Le résumé en dernier : il compte aussi les changements de prix détectés juste avant.
  await step("resume", () => sendDailySummary(origin, now).then((t) => (t.length > 60 ? "envoyé" : t)));
  report.dureeMs = Date.now() - started;
  return report;
}
