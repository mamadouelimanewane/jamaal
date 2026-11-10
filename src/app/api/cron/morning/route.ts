import { sendMorningKit } from "@/lib/automation/morning-kit";
import { watchChoganPrices } from "@/lib/automation/chogan-watch";
import { sendCopilots } from "@/lib/copilot/run";
import { claimAutomation } from "@/lib/automation-settings";
import { siteBaseUrl } from "@/lib/site-url";
import { retryPendingWithdrawals } from "@/lib/wallet";
import { recordAutomationRun } from "@/lib/automation/run-log";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Kit du matin des revendeurs (cron Vercel, 8 h à Dakar). Même protection que la tâche du soir. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    if (req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Accès refusé.", { status: 401 });
  } else {
    if (!(req.headers.get("user-agent") ?? "").startsWith("vercel-cron")) return new Response("Accès refusé.", { status: 401 });
    if (!(await claimAutomation(`cron-matin:${new Date().toISOString().slice(0, 10)}`))) return Response.json({ ok: true, deja: true });
  }
  const started = new Date();
  try {
    const retraits = await retryPendingWithdrawals(20).catch((e) => ({ erreur: String(e) }));
    const kit = await sendMorningKit(siteBaseUrl());
    const copilote = await sendCopilots(siteBaseUrl(), new Date(), { budgetMs: 20_000 }).catch((e) => ({ erreur: String(e) }));
    // Le temps restant sert à la mise à jour du catalogue Chogan (prix et nouveautés).
    const chogan = await watchChoganPrices(Math.max(5_000, 52_000 - (Date.now() - started.getTime()))).catch((e) => ({ erreur: String(e) }));
    const report = { retraits, kit, copilote, chogan };
    await recordAutomationRun("morning", started, report);
    return Response.json({ ok: true, report });
  } catch (e) {
    console.error("[kit du matin]", e);
    await recordAutomationRun("morning", started, {}, e);
    return Response.json({ ok: false }, { status: 500 });
  }
}
